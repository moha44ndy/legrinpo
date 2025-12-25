<?php
/**
 * Script d'installation de la base de données
 * À exécuter via : http://localhost/groupe_politique/database/install.php
 * 
 * Assurez-vous que MySQL est démarré dans MAMP/XAMPP
 */

// Configuration de la base de données
$host = 'localhost';
$port = 3306;
$dbname = 'groupe_po_db';
$username = 'root';
$password = ''; // Modifiez si vous avez un mot de passe

// Lire le fichier SQL
$sqlFile = __DIR__ . '/schema.sql';
$sql = file_get_contents($sqlFile);

if ($sql === false) {
    die("Erreur : Impossible de lire le fichier schema.sql");
}

try {
    // Connexion à MySQL (sans spécifier la base de données)
    $pdo = new PDO(
        "mysql:host=$host;port=$port;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    echo "<h1>Installation de la Base de Données</h1>";
    echo "<pre>";

    // Diviser le script SQL en requêtes individuelles
    $queries = array_filter(
        array_map('trim', explode(';', $sql)),
        function($query) {
            return !empty($query) && 
                   !preg_match('/^--/', $query) && 
                   !preg_match('/^\/\*/', $query);
        }
    );

    $successCount = 0;
    $errorCount = 0;

    foreach ($queries as $query) {
        // Ignorer les commentaires et lignes vides
        $query = preg_replace('/--.*$/m', '', $query);
        $query = trim($query);
        
        if (empty($query)) {
            continue;
        }

        try {
            $pdo->exec($query);
            $successCount++;
            
            // Afficher un message pour les requêtes importantes
            if (preg_match('/CREATE (DATABASE|TABLE)/i', $query)) {
                if (preg_match('/CREATE DATABASE.*?`?(\w+)`?/i', $query, $matches)) {
                    echo "✓ Base de données créée : {$matches[1]}\n";
                } elseif (preg_match('/CREATE TABLE.*?`?(\w+)`?/i', $query, $matches)) {
                    echo "✓ Table créée : {$matches[1]}\n";
                }
            } elseif (preg_match('/INSERT INTO/i', $query)) {
                if (preg_match('/INSERT INTO.*?`?(\w+)`?/i', $query, $matches)) {
                    echo "✓ Données insérées dans : {$matches[1]}\n";
                }
            }
        } catch (PDOException $e) {
            $errorCount++;
            // Ignorer les erreurs "déjà existe" pour CREATE DATABASE/TABLE IF NOT EXISTS
            if (!preg_match('/already exists/i', $e->getMessage())) {
                echo "⚠ Erreur : " . $e->getMessage() . "\n";
                echo "   Requête : " . substr($query, 0, 100) . "...\n\n";
            }
        }
    }

    echo "\n";
    echo "========================================\n";
    echo "Installation terminée !\n";
    echo "✓ Requêtes réussies : $successCount\n";
    if ($errorCount > 0) {
        echo "⚠ Erreurs : $errorCount\n";
    }
    echo "========================================\n";
    echo "\n";
    echo "Vous pouvez maintenant :\n";
    echo "1. Vérifier dans phpMyAdmin que la base 'groupe_po_db' existe\n";
    echo "2. Configurer votre application pour utiliser cette base de données\n";
    echo "3. Tester la connexion\n";

    echo "</pre>";
    echo "<p><a href='../'>Retour à l'application</a></p>";

} catch (PDOException $e) {
    echo "<h1>Erreur de Connexion</h1>";
    echo "<p style='color: red;'>Impossible de se connecter à MySQL : " . $e->getMessage() . "</p>";
    echo "<p>Vérifiez que :</p>";
    echo "<ul>";
    echo "<li>MySQL est démarré dans MAMP/XAMPP</li>";
    echo "<li>Les identifiants dans install.php sont corrects</li>";
    echo "<li>Le port MySQL est correct (3306 par défaut)</li>";
    echo "</ul>";
}
?>

