<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$host = '127.0.0.1';
$dbName = 'vicom_database';
$dbUser = 'root';
$dbPassword = '';

function respond(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function input(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function notifyUser(PDO $pdo, string $userId, string $type, string $commissionId, string $text): void {
    $statement = $pdo->prepare('INSERT INTO notifications (user_id, type, commission_id, text) VALUES (?, ?, ?, ?)');
    $statement->execute([$userId, $type, $commissionId, $text]);
}

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbName;charset=utf8mb4",
        $dbUser,
        $dbPassword,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $error) {
    respond(['error' => 'Database connection failed. Import database.sql and start MySQL in XAMPP.'], 503);
}

$action = $_GET['action'] ?? '';
$data = input();

if ($action === 'register') {
    $email = strtolower(trim($data['email'] ?? ''));
    $name = trim($data['name'] ?? '');
    $password = (string) ($data['password'] ?? '');
    $role = ($data['role'] ?? 'customer') === 'artist' ? 'artist' : 'customer';
    $specialty = trim($data['specialty'] ?? '');

    if (!$email || !$name || strlen($password) < 6 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(['error' => 'Enter a valid email, name, and password with at least 6 characters.'], 422);
    }

    $check = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $check->execute([$email]);
    if ($check->fetch()) {
        respond(['error' => 'An account with that email already exists.'], 409);
    }

    $id = 'user_' . bin2hex(random_bytes(8));
    $statement = $pdo->prepare('INSERT INTO users (id, email, password, name, role, specialty) VALUES (?, ?, ?, ?, ?, ?)');
    $statement->execute([$id, $email, password_hash($password, PASSWORD_DEFAULT), $name, $role, $specialty]);
    respond(['user' => ['id' => $id, 'email' => $email, 'name' => $name, 'role' => $role, 'specialty' => $specialty]]);
}

if ($action === 'login') {
    $email = strtolower(trim($data['email'] ?? ''));
    $password = (string) ($data['password'] ?? '');
    $statement = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $statement->execute([$email]);
    $user = $statement->fetch();

    if (!$user || (!password_verify($password, $user['password']) && !hash_equals($user['password'], $password))) {
        respond(['error' => 'That email and password do not match.'], 401);
    }
    if (!password_verify($password, $user['password'])) {
        $rehash = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
        $rehash->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    }
    unset($user['password']);
    respond(['user' => $user]);
}

if ($action === 'update_profile') {
    $id = trim($data['id'] ?? '');
    $email = strtolower(trim($data['email'] ?? ''));
    $name = trim($data['name'] ?? '');
    $specialty = trim($data['specialty'] ?? '');
    $password = (string) ($data['password'] ?? '');
    if (!$id || !$email || !$name) respond(['error' => 'Name and email are required.'], 422);

    $duplicate = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
    $duplicate->execute([$email, $id]);
    if ($duplicate->fetch()) respond(['error' => 'That email is already being used.'], 409);

    if ($password) {
        $statement = $pdo->prepare('UPDATE users SET email = ?, name = ?, specialty = ?, password = ? WHERE id = ?');
        $statement->execute([$email, $name, $specialty, password_hash($password, PASSWORD_DEFAULT), $id]);
    } else {
        $statement = $pdo->prepare('UPDATE users SET email = ?, name = ?, specialty = ? WHERE id = ?');
        $statement->execute([$email, $name, $specialty, $id]);
    }
    respond(['user' => ['id' => $id, 'email' => $email, 'name' => $name, 'specialty' => $specialty]]);
}

if ($action === 'create_artwork') {
    $id = trim($data['id'] ?? '');
    $artistId = trim($data['artistId'] ?? '');
    $title = trim($data['title'] ?? '');
    $detail = trim($data['detail'] ?? '');
    $category = trim($data['category'] ?? '');
    $image = (string) ($data['image'] ?? '');
    $price = (float) ($data['price'] ?? 0);
    if (!$artistId || !$title || !$category || !$image || $price <= 0) respond(['error' => 'Artwork title, category, image, and price are required.'], 422);

    $artistCheck = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'artist'");
    $artistCheck->execute([$artistId]);
    if (!$artistCheck->fetch()) respond(['error' => 'Artist account not found.'], 404);

    $statement = $pdo->prepare('INSERT INTO artworks (id, artist_id, title, detail, price, category, image) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $statement->execute([$id ?: 'work_' . bin2hex(random_bytes(8)), $artistId, $title, $detail, $price, $category, $image]);
    respond(['status' => 'created']);
}

if ($action === 'artworks') {
    $statement = $pdo->query('SELECT a.id, a.artist_id AS artistId, u.name AS artist, a.title, a.detail, CONCAT("$", FORMAT(a.price, 2)) AS price, a.category, a.image, a.created_at AS createdAt FROM artworks a INNER JOIN users u ON u.id = a.artist_id ORDER BY a.created_at DESC');
    respond(['artworks' => $statement->fetchAll()]);
}

if ($action === 'artist') {
    $artistId = trim($_GET['id'] ?? '');
    if (!$artistId) respond(['error' => 'Artist id is required.'], 422);

    $columnCheck = $pdo->query("SHOW COLUMNS FROM users LIKE 'profile_views'");
    if (!$columnCheck->fetch()) {
        $pdo->exec('ALTER TABLE users ADD COLUMN profile_views INT UNSIGNED NOT NULL DEFAULT 0');
    }

    $viewStatement = $pdo->prepare("UPDATE users SET profile_views = profile_views + 1 WHERE id = ? AND role = 'artist'");
    $viewStatement->execute([$artistId]);

    $artistStatement = $pdo->prepare("SELECT id, name, specialty, role, profile_views AS profileViews FROM users WHERE id = ? AND role = 'artist' LIMIT 1");
    $artistStatement->execute([$artistId]);
    $artist = $artistStatement->fetch();
    if (!$artist) respond(['error' => 'Artist not found.'], 404);

    $artworkStatement = $pdo->prepare('SELECT id, artist_id AS artistId, title, detail, CONCAT("$", FORMAT(price, 2)) AS price, category, image, created_at AS createdAt FROM artworks WHERE artist_id = ? ORDER BY created_at DESC');
    $artworkStatement->execute([$artistId]);
    respond(['artist' => $artist, 'artworks' => $artworkStatement->fetchAll()]);
}

if ($action === 'artist_stats') {
    $artistId = trim($_GET['id'] ?? '');
    if (!$artistId) respond(['error' => 'Artist id is required.'], 422);

    $columnCheck = $pdo->query("SHOW COLUMNS FROM users LIKE 'profile_views'");
    if (!$columnCheck->fetch()) {
        $pdo->exec('ALTER TABLE users ADD COLUMN profile_views INT UNSIGNED NOT NULL DEFAULT 0');
    }

    $statement = $pdo->prepare("SELECT profile_views AS profileViews FROM users WHERE id = ? AND role = 'artist' LIMIT 1");
    $statement->execute([$artistId]);
    $artist = $statement->fetch();
    if (!$artist) respond(['error' => 'Artist not found.'], 404);
    respond($artist);
}

if ($action === 'create_commission') {
    $artistId = trim((string) ($data['artistId'] ?? ''));
    $clientId = trim((string) ($data['clientId'] ?? ''));
    $title = trim((string) ($data['title'] ?? ''));
    $description = trim((string) ($data['description'] ?? ''));
    if (!$artistId || !$clientId || !$title) respond(['error' => 'Artist, client, and title are required.'], 422);

    $artist = $pdo->prepare("SELECT name FROM users WHERE id = ? AND role = 'artist'");
    $artist->execute([$artistId]);
    $artistUser = $artist->fetch();
    $client = $pdo->prepare("SELECT name FROM users WHERE id = ? AND role = 'customer'");
    $client->execute([$clientId]);
    $clientUser = $client->fetch();
    if (!$artistUser || !$clientUser) respond(['error' => 'Artist or client account not found.'], 404);

    $id = 'commission_' . bin2hex(random_bytes(8));
    $statement = $pdo->prepare('INSERT INTO commissions (id, artist_id, client_id, title, description) VALUES (?, ?, ?, ?, ?)');
    $statement->execute([$id, $artistId, $clientId, $title, $description]);
    notifyUser($pdo, $artistId, 'new_commission', $id, $clientUser['name'] . ' sent you a commission request for "' . $title . '".');
    respond(['id' => $id, 'status' => 'created']);
}

if ($action === 'commissions') {
    $userId = trim((string) ($_GET['userId'] ?? ''));
    $role = ($_GET['role'] ?? '') === 'artist' ? 'artist' : 'customer';
    if (!$userId) respond(['error' => 'User id is required.'], 422);
    $column = $role === 'artist' ? 'c.artist_id' : 'c.client_id';
    $statement = $pdo->prepare("SELECT c.*, a.name AS artistName, u.name AS clientName FROM commissions c INNER JOIN users a ON a.id = c.artist_id INNER JOIN users u ON u.id = c.client_id WHERE $column = ? ORDER BY c.updated_at DESC");
    $statement->execute([$userId]);
    $commissions = $statement->fetchAll();
    foreach ($commissions as &$commission) {
        $commission['stageStatus'] = json_decode($commission['stage_status'], true) ?: array_fill(0, 5, false);
        $commission['clientApproval'] = json_decode($commission['client_approval'], true) ?: array_fill(0, 5, false);
        $commission['stageData'] = json_decode($commission['stage_data'], true) ?: array_fill(0, 5, ['uploads' => [], 'note' => null]);
        $commission['currentStage'] = (int) $commission['current_stage'];
        $commission['artistId'] = $commission['artist_id'];
        $commission['clientId'] = $commission['client_id'];
        unset($commission['stage_status'], $commission['client_approval'], $commission['stage_data'], $commission['artist_id'], $commission['client_id'], $commission['current_stage']);
    }
    respond(['commissions' => $commissions]);
}

if ($action === 'update_commission_status') {
    $id = trim((string) ($data['id'] ?? ''));
    $status = (string) ($data['status'] ?? '');
    if (!$id || !in_array($status, ['active', 'declined'], true)) respond(['error' => 'Invalid commission status.'], 422);
    $statement = $pdo->prepare('UPDATE commissions SET status = ? WHERE id = ?');
    $statement->execute([$status, $id]);
    $lookup = $pdo->prepare('SELECT artist_id, client_id, title FROM commissions WHERE id = ?');
    $lookup->execute([$id]);
    $commission = $lookup->fetch();
    if (!$commission) respond(['error' => 'Commission not found.'], 404);
    notifyUser($pdo, $commission['client_id'], $status === 'active' ? 'commission_accepted' : 'commission_declined', $id, 'Your commission request was ' . ($status === 'active' ? 'accepted.' : 'declined.'));
    respond(['status' => 'updated']);
}

if ($action === 'update_commission_stage') {
    $id = trim((string) ($data['id'] ?? ''));
    if (!$id) respond(['error' => 'Commission id is required.'], 422);
    $fields = [];
    $values = [];
    if (array_key_exists('stageData', $data)) { $fields[] = 'stage_data = ?'; $values[] = json_encode($data['stageData']); }
    if (array_key_exists('stageStatus', $data)) { $fields[] = 'stage_status = ?'; $values[] = json_encode($data['stageStatus']); }
    if (array_key_exists('clientApproval', $data)) { $fields[] = 'client_approval = ?'; $values[] = json_encode($data['clientApproval']); }
    if (array_key_exists('currentStage', $data)) { $fields[] = 'current_stage = ?'; $values[] = (int) $data['currentStage']; }
    if (array_key_exists('status', $data) && $data['status']) { $fields[] = 'status = ?'; $values[] = $data['status']; }
    if (!$fields) respond(['error' => 'No stage changes supplied.'], 422);
    $values[] = $id;
    $statement = $pdo->prepare('UPDATE commissions SET ' . implode(', ', $fields) . ' WHERE id = ?');
    $statement->execute($values);
    $lookup = $pdo->prepare('SELECT artist_id, client_id FROM commissions WHERE id = ?');
    $lookup->execute([$id]);
    $commission = $lookup->fetch();
    if (!$commission) respond(['error' => 'Commission not found.'], 404);
    if (!empty($data['notify']['userId'])) {
        notifyUser($pdo, $data['notify']['userId'], (string) ($data['notify']['type'] ?? 'new_message'), $id, (string) ($data['notify']['text'] ?? 'Commission updated.'));
    }
    respond(['status' => 'updated']);
}

if ($action === 'messages') {
    $commissionId = trim((string) ($_GET['commissionId'] ?? ''));
    if (!$commissionId) respond(['error' => 'Commission id is required.'], 422);
    $statement = $pdo->prepare('SELECT id, sender_id AS senderId, sender_name AS senderName, sender_role AS senderRole, message, is_read AS isRead, created_at AS createdAt FROM commission_messages WHERE commission_id = ? ORDER BY created_at ASC, id ASC');
    $statement->execute([$commissionId]);
    respond(['messages' => $statement->fetchAll()]);
}

if ($action === 'send_message') {
    $commissionId = trim((string) ($data['commissionId'] ?? ''));
    $senderId = trim((string) ($data['senderId'] ?? ''));
    $senderName = trim((string) ($data['senderName'] ?? ''));
    $senderRole = ($data['senderRole'] ?? '') === 'artist' ? 'artist' : 'customer';
    $message = trim((string) ($data['message'] ?? ''));
    if (!$commissionId || !$senderId || !$senderName || !$message) respond(['error' => 'Message fields are required.'], 422);
    $statement = $pdo->prepare('INSERT INTO commission_messages (commission_id, sender_id, sender_name, sender_role, message) VALUES (?, ?, ?, ?, ?)');
    $statement->execute([$commissionId, $senderId, $senderName, $senderRole, $message]);
    $lookup = $pdo->prepare('SELECT artist_id, client_id FROM commissions WHERE id = ?');
    $lookup->execute([$commissionId]);
    $commission = $lookup->fetch();
    if (!$commission) respond(['error' => 'Commission not found.'], 404);
    notifyUser($pdo, $senderRole === 'artist' ? $commission['client_id'] : $commission['artist_id'], 'new_message', $commissionId, $senderName . ' sent a new commission message.');
    respond(['status' => 'sent']);
}

if ($action === 'mark_messages_read') {
    $commissionId = trim((string) ($data['commissionId'] ?? ''));
    $userId = trim((string) ($data['userId'] ?? ''));
    if (!$commissionId || !$userId) respond(['error' => 'Commission and user ids are required.'], 422);
    $statement = $pdo->prepare('UPDATE commission_messages SET is_read = 1 WHERE commission_id = ? AND sender_id <> ?');
    $statement->execute([$commissionId, $userId]);
    respond(['status' => 'updated']);
}

respond(['error' => 'Unknown API action.'], 404);
