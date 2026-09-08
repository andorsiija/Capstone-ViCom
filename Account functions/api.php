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

respond(['error' => 'Unknown API action.'], 404);
