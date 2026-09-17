<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$host     = '127.0.0.1';
$dbName   = 'vicom_database';
$dbUser   = 'root';
$dbPass   = '';

function respond(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}
function input(): array {
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}
function newId(string $prefix = 'id'): string {
    return $prefix . '_' . bin2hex(random_bytes(8));
}

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbName;charset=utf8mb4",
        $dbUser, $dbPass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    respond(['error' => 'Database connection failed. Import database.sql and start MySQL in XAMPP.'], 503);
}

$action = $_GET['action'] ?? '';
$data   = input();

/* ══════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════ */
if ($action === 'register') {
    $email     = strtolower(trim($data['email'] ?? ''));
    $name      = trim($data['name'] ?? '');
    $password  = (string)($data['password'] ?? '');
    $role      = ($data['role'] ?? 'customer') === 'artist' ? 'artist' : 'customer';
    $specialty = trim($data['specialty'] ?? '');

    if (!$email || !$name || strlen($password) < 6 || !filter_var($email, FILTER_VALIDATE_EMAIL))
        respond(['error' => 'Enter a valid email, name, and password with at least 6 characters.'], 422);

    $chk = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $chk->execute([$email]);
    if ($chk->fetch()) respond(['error' => 'An account with that email already exists.'], 409);

    $id  = newId('user');
    $pdo->prepare('INSERT INTO users (id,email,password,name,role,specialty) VALUES (?,?,?,?,?,?)')
        ->execute([$id, $email, password_hash($password, PASSWORD_DEFAULT), $name, $role, $specialty]);
    respond(['user' => ['id'=>$id,'email'=>$email,'name'=>$name,'role'=>$role,'specialty'=>$specialty]]);
}

if ($action === 'login') {
    $email    = strtolower(trim($data['email'] ?? ''));
    $password = (string)($data['password'] ?? '');
    $st = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $st->execute([$email]);
    $user = $st->fetch();

    if (!$user || (!password_verify($password, $user['password']) && !hash_equals($user['password'], $password)))
        respond(['error' => 'That email and password do not match.'], 401);

    if (!password_verify($password, $user['password'])) {
        $pdo->prepare('UPDATE users SET password=? WHERE id=?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    }
    unset($user['password']);
    respond(['user' => $user]);
}

if ($action === 'profile') {
    $id = trim($_GET['id'] ?? '');
    if (!$id) respond(['error' => 'User id is required.'], 422);

    $st = $pdo->prepare('SELECT id,email,name,role,specialty FROM users WHERE id=? LIMIT 1');
    $st->execute([$id]);
    $user = $st->fetch();
    if (!$user) respond(['error' => 'User not found.'], 404);
    respond(['user' => $user]);
}

if ($action === 'update_profile') {
    $id        = trim($data['id'] ?? '');
    $email     = strtolower(trim($data['email'] ?? ''));
    $name      = trim($data['name'] ?? '');
    $specialty = trim($data['specialty'] ?? '');
    $password  = (string)($data['password'] ?? '');
    if (!$id || !$email || !$name) respond(['error' => 'Name and email are required.'], 422);

    $dup = $pdo->prepare('SELECT id FROM users WHERE email=? AND id<>?');
    $dup->execute([$email, $id]);
    if ($dup->fetch()) respond(['error' => 'That email is already being used.'], 409);

    if ($password) {
        $pdo->prepare('UPDATE users SET email=?,name=?,specialty=?,password=? WHERE id=?')
            ->execute([$email, $name, $specialty, password_hash($password, PASSWORD_DEFAULT), $id]);
    } else {
        $pdo->prepare('UPDATE users SET email=?,name=?,specialty=? WHERE id=?')
            ->execute([$email, $name, $specialty, $id]);
    }
    respond(['user' => ['id'=>$id,'email'=>$email,'name'=>$name,'specialty'=>$specialty]]);
}

/* ══════════════════════════════════════════════════════
   ARTWORKS
══════════════════════════════════════════════════════ */
if ($action === 'create_artwork') {
    $id       = trim($data['id'] ?? '') ?: newId('work');
    $artistId = trim($data['artistId'] ?? '');
    $title    = trim($data['title'] ?? '');
    $detail   = trim($data['detail'] ?? '');
    $category = trim($data['category'] ?? '');
    $image    = (string)($data['image'] ?? '');
    $price    = (float)($data['price'] ?? 0);
    if (!$artistId || !$title || !$category || !$image || $price <= 0)
        respond(['error' => 'Artwork title, category, image, and price are required.'], 422);

    $chk = $pdo->prepare("SELECT id FROM users WHERE id=? AND role='artist'");
    $chk->execute([$artistId]);
    if (!$chk->fetch()) respond(['error' => 'Artist account not found.'], 404);

    $pdo->prepare('INSERT INTO artworks (id,artist_id,title,detail,price,category,image) VALUES (?,?,?,?,?,?,?)')
        ->execute([$id, $artistId, $title, $detail, $price, $category, $image]);
    respond(['status' => 'created']);
}

if ($action === 'artworks') {
    $st = $pdo->query('SELECT a.id, a.artist_id AS artistId, u.name AS artist, a.title, a.detail,
        CONCAT("₱",FORMAT(a.price,2)) AS price, a.category, a.image,
        a.created_at AS createdAt
        FROM artworks a INNER JOIN users u ON u.id=a.artist_id ORDER BY a.created_at DESC');
    respond(['artworks' => $st->fetchAll()]);
}

/* ══════════════════════════════════════════════════════
   ARTIST PROFILE & STATS
══════════════════════════════════════════════════════ */
if ($action === 'artist') {
    $artistId = trim($_GET['id'] ?? '');
    if (!$artistId) respond(['error' => 'Artist id is required.'], 422);

    $pdo->prepare("UPDATE users SET profile_views=profile_views+1 WHERE id=? AND role='artist'")->execute([$artistId]);

    $st = $pdo->prepare("SELECT id,name,specialty,role,profile_views AS profileViews FROM users WHERE id=? AND role='artist' LIMIT 1");
    $st->execute([$artistId]);
    $artist = $st->fetch();
    if (!$artist) respond(['error' => 'Artist not found.'], 404);

    $aw = $pdo->prepare('SELECT id,artist_id AS artistId,title,detail,
        CONCAT("₱",FORMAT(price,2)) AS price,category,image,created_at AS createdAt
        FROM artworks WHERE artist_id=? ORDER BY created_at DESC');
    $aw->execute([$artistId]);
    respond(['artist' => $artist, 'artworks' => $aw->fetchAll()]);
}

if ($action === 'artist_stats') {
    $artistId = trim($_GET['id'] ?? '');
    if (!$artistId) respond(['error' => 'Artist id is required.'], 422);

    $st = $pdo->prepare("SELECT profile_views AS profileViews FROM users WHERE id=? AND role='artist' LIMIT 1");
    $st->execute([$artistId]);
    $artist = $st->fetch();
    if (!$artist) respond(['error' => 'Artist not found.'], 404);
    respond($artist);
}

/* ══════════════════════════════════════════════════════
   COMMISSIONS — CREATE (client sends request)
══════════════════════════════════════════════════════ */
if ($action === 'create_commission') {
    $id          = trim($data['id'] ?? '') ?: newId('comm');
    $artistId    = trim($data['artistId'] ?? '');
    $clientId    = trim($data['clientId'] ?? '');
    $title       = trim($data['title'] ?? '');
    $description = trim($data['description'] ?? '');

    if (!$artistId || !$clientId || !$title)
        respond(['error' => 'Artist, client, and title are required.'], 422);

    // Verify artist & client exist
    $aChk = $pdo->prepare("SELECT id FROM users WHERE id=? AND role='artist'");
    $aChk->execute([$artistId]);
    if (!$aChk->fetch()) respond(['error' => 'Artist not found.'], 404);

    $emptyStages  = json_encode(array_fill(0, 5, ['uploads'=>[],'note'=>null,'comments'=>[]]));
    $falseFive    = json_encode([false,false,false,false,false]);

    $pdo->prepare('INSERT INTO commissions
        (id,artist_id,client_id,title,description,status,current_stage,stage_status,client_approval,stage_data)
        VALUES (?,?,?,?,?,?,?,?,?,?)')
        ->execute([$id, $artistId, $clientId, $title, $description, 'pending', 0, $falseFive, $falseFive, $emptyStages]);

    // Get client name for notification
    $cSt = $pdo->prepare('SELECT name FROM users WHERE id=?');
    $cSt->execute([$clientId]);
    $client = $cSt->fetch();
    $clientName = $client['name'] ?? 'A client';

    // Notify artist
    $pdo->prepare('INSERT INTO notifications (user_id,type,commission_id,text) VALUES (?,?,?,?)')
        ->execute([$artistId, 'new_commission', $id, "$clientName sent you a commission request: \"$title\""]);

    respond(['commission' => ['id' => $id, 'status' => 'pending']]);
}

/* ══════════════════════════════════════════════════════
   COMMISSIONS — LIST (for sidebar)
══════════════════════════════════════════════════════ */
if ($action === 'commissions') {
    $userId = trim($_GET['userId'] ?? '');
    $role   = trim($_GET['role'] ?? '');
    if (!$userId || !in_array($role, ['artist','customer']))
        respond(['error' => 'userId and role are required.'], 422);

    $col = $role === 'artist' ? 'artist_id' : 'client_id';
    $st  = $pdo->prepare("
        SELECT c.id, c.title, c.description, c.status, c.current_stage AS currentStage,
               c.stage_status AS stageStatus, c.client_approval AS clientApproval,
               c.stage_data AS stageData, c.created_at AS createdAt, c.updated_at AS updatedAt,
               ua.name AS artistName, uc.name AS clientName,
               c.artist_id AS artistId, c.client_id AS clientId
        FROM commissions c
        INNER JOIN users ua ON ua.id=c.artist_id
        INNER JOIN users uc ON uc.id=c.client_id
        WHERE c.$col = ?
        ORDER BY FIELD(c.status,'pending','active','done','declined'),
                 c.updated_at DESC");
    $st->execute([$userId]);
    $rows = $st->fetchAll();

    // decode JSON columns
    foreach ($rows as &$r) {
        $r['stageStatus']    = json_decode($r['stageStatus'], true);
        $r['clientApproval'] = json_decode($r['clientApproval'], true);
        $r['stageData']      = json_decode($r['stageData'], true);
        $r['currentStage']   = (int)$r['currentStage'];
    }
    respond(['commissions' => $rows]);
}

/* ══════════════════════════════════════════════════════
   COMMISSIONS — SINGLE
══════════════════════════════════════════════════════ */
if ($action === 'commission') {
    $id = trim($_GET['id'] ?? '');
    if (!$id) respond(['error' => 'id is required.'], 422);

    $st = $pdo->prepare("
        SELECT c.*, ua.name AS artistName, uc.name AS clientName
        FROM commissions c
        INNER JOIN users ua ON ua.id=c.artist_id
        INNER JOIN users uc ON uc.id=c.client_id
        WHERE c.id=? LIMIT 1");
    $st->execute([$id]);
    $c = $st->fetch();
    if (!$c) respond(['error' => 'Commission not found.'], 404);
    $c['stageStatus']    = json_decode($c['stage_status'], true);
    $c['clientApproval'] = json_decode($c['client_approval'], true);
    $c['stageData']      = json_decode($c['stage_data'], true);
    $c['currentStage']   = (int)$c['current_stage'];
    unset($c['stage_status'], $c['client_approval'], $c['stage_data'], $c['current_stage']);
    respond(['commission' => $c]);
}

/* ══════════════════════════════════════════════════════
   COMMISSIONS — UPDATE STATUS (accept / decline)
══════════════════════════════════════════════════════ */
if ($action === 'update_commission_status') {
    $id     = trim($data['id'] ?? '');
    $status = trim($data['status'] ?? '');
    if (!$id || !in_array($status, ['active','declined']))
        respond(['error' => 'id and valid status required.'], 422);

    $pdo->prepare('UPDATE commissions SET status=? WHERE id=?')->execute([$status, $id]);

    // Notify client
    $st = $pdo->prepare("SELECT c.client_id,c.title,ua.name AS artistName
        FROM commissions c INNER JOIN users ua ON ua.id=c.artist_id WHERE c.id=?");
    $st->execute([$id]);
    $c = $st->fetch();
    if ($c) {
        $text = $status === 'active'
            ? "{$c['artistName']} accepted your commission request: \"{$c['title']}\""
            : "{$c['artistName']} declined your commission request: \"{$c['title']}\"";
        $type = $status === 'active' ? 'commission_accepted' : 'commission_declined';
        $pdo->prepare('INSERT INTO notifications (user_id,type,commission_id,text) VALUES (?,?,?,?)')
            ->execute([$c['client_id'], $type, $id, $text]);
    }
    respond(['status' => 'updated']);
}

/* ══════════════════════════════════════════════════════
   COMMISSIONS — UPDATE STAGE DATA (uploads, notes, stageStatus, clientApproval)
══════════════════════════════════════════════════════ */
if ($action === 'update_commission_stage') {
    $id            = trim($data['id'] ?? '');
    $currentStage  = isset($data['currentStage']) ? (int)$data['currentStage'] : null;
    $stageStatus   = $data['stageStatus']   ?? null;
    $clientApproval= $data['clientApproval']?? null;
    $stageData     = $data['stageData']     ?? null;
    $commStatus    = $data['status']        ?? null;

    if (!$id) respond(['error' => 'id is required.'], 422);

    // Lock down any stage the client has already approved: whatever the artist
    // (or a tampered request) sends for those indices is ignored server-side,
    // so approved uploads/notes can never be swapped out after confirmation.
    if ($stageData !== null) {
        $row = $pdo->prepare('SELECT stage_data, client_approval FROM commissions WHERE id=?');
        $row->execute([$id]);
        $existing = $row->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            $oldStageData = json_decode($existing['stage_data'] ?? '[]', true) ?: [];
            $approvedArr  = json_decode($existing['client_approval'] ?? '[]', true) ?: [];
            foreach ($approvedArr as $idx => $isApproved) {
                if ($isApproved && array_key_exists($idx, $oldStageData)) {
                    $stageData[$idx] = $oldStageData[$idx];
                }
            }
        }
    }

    $sets = []; $params = [];

    if ($stageData !== null)      { $sets[] = 'stage_data=?';      $params[] = json_encode($stageData); }
    if ($stageStatus !== null)    { $sets[] = 'stage_status=?';    $params[] = json_encode($stageStatus); }
    if ($clientApproval !== null) { $sets[] = 'client_approval=?'; $params[] = json_encode($clientApproval); }
    if ($currentStage !== null)   { $sets[] = 'current_stage=?';   $params[] = $currentStage; }
    if ($commStatus !== null)     { $sets[] = 'status=?';           $params[] = $commStatus; }

    if (empty($sets)) respond(['error' => 'Nothing to update.'], 422);

    $params[] = $id;
    $pdo->prepare('UPDATE commissions SET '.implode(',',$sets).' WHERE id=?')->execute($params);

    // Notifications
    if (!empty($data['notify'])) {
        $n = $data['notify'];
        $pdo->prepare('INSERT INTO notifications (user_id,type,commission_id,text) VALUES (?,?,?,?)')
            ->execute([$n['userId'], $n['type'], $id, $n['text']]);
    }

    respond(['status' => 'updated']);
}

/* ══════════════════════════════════════════════════════
   MESSAGES — LIST per commission
══════════════════════════════════════════════════════ */
if ($action === 'messages') {
    $commId = trim($_GET['commissionId'] ?? '');
    if (!$commId) respond(['error' => 'commissionId is required.'], 422);

    $st = $pdo->prepare('SELECT id,commission_id AS commissionId,sender_id AS senderId,
        sender_name AS senderName,sender_role AS senderRole,message,is_read AS isRead,
        created_at AS createdAt
        FROM commission_messages WHERE commission_id=? ORDER BY created_at ASC');
    $st->execute([$commId]);
    respond(['messages' => $st->fetchAll()]);
}

/* ══════════════════════════════════════════════════════
   MESSAGES — SEND
══════════════════════════════════════════════════════ */
if ($action === 'send_message') {
    $commId     = trim($data['commissionId'] ?? '');
    $senderId   = trim($data['senderId'] ?? '');
    $senderName = trim($data['senderName'] ?? '');
    $senderRole = trim($data['senderRole'] ?? '');
    $message    = trim($data['message'] ?? '');

    if (!$commId || !$senderId || !$message || !in_array($senderRole, ['artist','customer']))
        respond(['error' => 'commissionId, senderId, senderRole, and message are required.'], 422);

    $pdo->prepare('INSERT INTO commission_messages
        (commission_id,sender_id,sender_name,sender_role,message)
        VALUES (?,?,?,?,?)')
        ->execute([$commId, $senderId, $senderName, $senderRole, $message]);

    $msgId = $pdo->lastInsertId();

    // Notify the OTHER party
    $st = $pdo->prepare('SELECT artist_id,client_id,title FROM commissions WHERE id=?');
    $st->execute([$commId]);
    $comm = $st->fetch();
    if ($comm) {
        $recipientId = $senderRole === 'artist' ? $comm['client_id'] : $comm['artist_id'];
        $text = "$senderName sent a message on \"{$comm['title']}\"";
        $pdo->prepare('INSERT INTO notifications (user_id,type,commission_id,text) VALUES (?,?,?,?)')
            ->execute([$recipientId, 'new_message', $commId, $text]);
    }

    respond(['message' => ['id' => $msgId, 'status' => 'sent']]);
}

/* ══════════════════════════════════════════════════════
   MESSAGES — MARK READ
══════════════════════════════════════════════════════ */
if ($action === 'mark_messages_read') {
    $commId    = trim($data['commissionId'] ?? '');
    $userId    = trim($data['userId'] ?? '');
    if (!$commId || !$userId) respond(['error' => 'commissionId and userId required.'], 422);

    $pdo->prepare('UPDATE commission_messages SET is_read=1
        WHERE commission_id=? AND sender_id<>?')->execute([$commId, $userId]);
    respond(['status' => 'marked']);
}

/* ══════════════════════════════════════════════════════
   DASHBOARD COUNTS (used by artist & client overview)
══════════════════════════════════════════════════════ */
if ($action === 'dashboard_counts') {
    $userId = trim($_GET['userId'] ?? '');
    $role   = trim($_GET['role'] ?? '');
    if (!$userId) respond(['error' => 'userId required.'], 422);

    $col = $role === 'artist' ? 'artist_id' : 'client_id';

    // active commissions
    $active = $pdo->prepare("SELECT COUNT(*) FROM commissions WHERE $col=? AND status='active'");
    $active->execute([$userId]);
    $activeCount = (int)$active->fetchColumn();

    // pending commissions (artist: requests to accept; client: awaiting artist)
    $pending = $pdo->prepare("SELECT COUNT(*) FROM commissions WHERE $col=? AND status='pending'");
    $pending->execute([$userId]);
    $pendingCount = (int)$pending->fetchColumn();

    // unread messages (messages on my commissions where sender is NOT me)
    $unread = $pdo->prepare("
        SELECT COUNT(*) FROM commission_messages cm
        INNER JOIN commissions c ON c.id=cm.commission_id
        WHERE c.$col=? AND cm.sender_id<>? AND cm.is_read=0");
    $unread->execute([$userId, $userId]);
    $unreadCount = (int)$unread->fetchColumn();

    // unread notifications
    $notifs = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0");
    $notifs->execute([$userId]);
    $notifCount = (int)$notifs->fetchColumn();

    respond([
        'active'        => $activeCount,
        'pending'       => $pendingCount,
        'unreadMessages'=> $unreadCount,
        'notifications' => $notifCount,
    ]);
}

/* ══════════════════════════════════════════════════════
   NOTIFICATIONS
══════════════════════════════════════════════════════ */
if ($action === 'notifications') {
    $userId = trim($_GET['userId'] ?? '');
    if (!$userId) respond(['error' => 'userId required.'], 422);
    $st = $pdo->prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30');
    $st->execute([$userId]);
    respond(['notifications' => $st->fetchAll()]);
}

if ($action === 'mark_notifications_read') {
    $userId = trim($data['userId'] ?? '');
    if (!$userId) respond(['error' => 'userId required.'], 422);
    $pdo->prepare('UPDATE notifications SET is_read=1 WHERE user_id=?')->execute([$userId]);
    respond(['status' => 'marked']);
}

respond(['error' => 'Unknown API action.'], 404);
