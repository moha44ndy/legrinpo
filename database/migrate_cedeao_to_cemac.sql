-- Migration CEDEAO -> CEMAC
-- À exécuter dans votre base PostgreSQL

-- 0. Créer la table rooms si elle n'existe pas
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'public',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 1. Mettre à jour ou insérer la room CEMAC
INSERT INTO rooms (room_id, name, description, type) VALUES
('public_cemac', 'CEMAC', 'Communauté Économique et Monétaire de l''Afrique Centrale', 'public')
ON CONFLICT (room_id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. Migrer les références CEDEAO vers CEMAC
UPDATE user_room_history SET room_id = 'public_cemac' WHERE room_id = 'public_cedeao';
UPDATE user_room_favorites SET room_id = 'public_cemac' WHERE room_id = 'public_cedeao';
UPDATE user_unread_rooms SET room_id = 'public_cemac' WHERE room_id = 'public_cedeao';
DELETE FROM rooms WHERE room_id = 'public_cedeao';
