create table anonymous_sessions (
id UUID primary key default gen_random_uuid (),
fingerprint TEXT unique not null,
questions_count INTEGER default 0 check (questions_count >= 0),
reset_date DATE default CURRENT_DATE,
created_at TIMESTAMPTZ default NOW(),
updated_at TIMESTAMPTZ default NOW()
);

create table chats (
id UUID primary key default gen_random_uuid (),
user_id UUID references auth.users (id) on delete CASCADE,
anonymous_id UUID references anonymous_sessions (id) on delete CASCADE,
title TEXT not null default 'Новый чат',
model_used VARCHAR(50) default 'gpt-3.5-turbo',
total_tokens INTEGER default 0,
is_archived BOOLEAN default false,
created_at TIMESTAMPTZ default NOW(),
updated_at TIMESTAMPTZ default NOW(),
last_message_at TIMESTAMPTZ default NOW(),

constraint chat_owner_check check (
(
user_id is not null
and anonymous_id is null
)
or (
user_id is null
and anonymous_id is not null
)
)
);

create table messages (
id UUID primary key default gen_random_uuid (),
chat_id UUID not null references chats (id) on delete CASCADE,
role VARCHAR(20) not null check (role in ('user', 'assistant', 'system')),
content TEXT not null,
tokens_used INTEGER default 0,
model VARCHAR(50),
parent_message_id UUID references messages (id) on delete set null,
response_time_ms INTEGER,
metadata JSONB default '{}'::jsonb,
created_at TIMESTAMPTZ default NOW()
);

create table attachments (
id UUID primary key default gen_random_uuid (),
message_id UUID not null references messages (id) on delete CASCADE,
file_name TEXT not null,
file_type VARCHAR(100) not null,
file_size INTEGER not null,
file_url TEXT not null,
thumbnail_url TEXT,
ocr_text TEXT,
width INTEGER,
height INTEGER,
created_at TIMESTAMPTZ default NOW()
);

create table documents (
id UUID primary key default gen_random_uuid (),
user_id UUID references auth.users (id) on delete CASCADE,
anonymous_id UUID references anonymous_sessions (id) on delete CASCADE,
file_name TEXT not null,
file_type VARCHAR(100) not null,
file_size INTEGER not null,
file_url TEXT not null,
content TEXT,
chunks JSONB default '[]'::jsonb,
embedding_model VARCHAR(50),
status VARCHAR(20) default 'processing' check (status in ('processing', 'ready', 'failed')),
error_message TEXT,
created_at TIMESTAMPTZ default NOW(),
processed_at TIMESTAMPTZ,

constraint document_owner_check check (
(
user_id is not null
and anonymous_id is null
)
or (
user_id is null
and anonymous_id is not null
)
)
);

create table chat_documents (
chat_id UUID not null references chats (id) on delete CASCADE,
document_id UUID not null references documents (id) on delete CASCADE,
context_used BOOLEAN default false,
created_at TIMESTAMPTZ default NOW(),
primary key (chat_id, document_id)
);

create index idx_chats_user_id on chats (user_id)
where
user_id is not null;

create index idx_chats_anonymous_id on chats (anonymous_id)
where
anonymous_id is not null;

create index idx_chats_updated_at on chats (updated_at desc);

create index idx_chats_last_message_at on chats (last_message_at desc);

create index idx_chats_user_updated on chats (user_id, updated_at desc)
where
user_id is not null;

create index idx_messages_chat_id on messages (chat_id);

create index idx_messages_created_at on messages (created_at);

create index idx_messages_parent_id on messages (parent_message_id);

create index idx_messages_chat_created on messages (chat_id, created_at);

create index idx_attachments_message_id on attachments (message_id);

create index idx_documents_user_id on documents (user_id)
where
user_id is not null;

create index idx_documents_anonymous_id on documents (anonymous_id)
where
anonymous_id is not null;

create index idx_documents_status on documents (status);

create index idx_documents_created_at on documents (created_at);

create index idx_chat_documents_chat_id on chat_documents (chat_id);

create index idx_chat_documents_document_id on chat_documents (document_id);

create index idx_anonymous_fingerprint on anonymous_sessions (fingerprint);

create index idx_anonymous_reset_date on anonymous_sessions (reset_date);

create or replace function update_updated_at_column () RETURNS TRIGGER as $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;

$$
LANGUAGE plpgsql;

create trigger update_chats_updated_at BEFORE
update on chats for EACH row
execute FUNCTION update_updated_at_column ();

create trigger update_anonymous_sessions_updated_at BEFORE
update on anonymous_sessions for EACH row
execute FUNCTION update_updated_at_column ();

create or replace function update_chat_last_message () RETURNS TRIGGER as
$$

BEGIN
UPDATE chats
SET last_message_at = NEW.created_at
WHERE id = NEW.chat_id;
RETURN NEW;
END;

$$
LANGUAGE plpgsql;

create trigger update_chat_timestamp
after INSERT on messages for EACH row
execute FUNCTION update_chat_last_message ();

CREATE OR REPLACE FUNCTION create_anonymous_session(p_fingerprint TEXT)
RETURNS UUID AS
$$

DECLARE
v_session_id UUID;
BEGIN
INSERT INTO anonymous_sessions (fingerprint)
VALUES (p_fingerprint)
ON CONFLICT (fingerprint)
DO UPDATE SET updated_at = NOW()
RETURNING id INTO v_session_id;

    RETURN v_session_id;

END;

$$
LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_anonymous_questions(p_fingerprint TEXT)
RETURNS INTEGER AS
$$

DECLARE
v_session_id UUID;
v_current_count INTEGER;
BEGIN

SELECT id INTO v_session_id
FROM anonymous_sessions
WHERE fingerprint = p_fingerprint;

    IF v_session_id IS NULL THEN
        SELECT create_anonymous_session(p_fingerprint) INTO v_session_id;
    END IF;

    UPDATE anonymous_sessions
    SET
        questions_count = CASE
            WHEN reset_date < CURRENT_DATE THEN 1
            ELSE questions_count + 1
        END,
        reset_date = CURRENT_DATE
    WHERE id = v_session_id
    RETURNING questions_count INTO v_current_count;

    RETURN v_current_count;

END;

$$
LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_anonymous_limit(p_fingerprint TEXT)
RETURNS BOOLEAN AS
$$

DECLARE
v_count INTEGER;
BEGIN
SELECT questions_count INTO v_count
FROM anonymous_sessions
WHERE fingerprint = p_fingerprint
AND reset_date = CURRENT_DATE;

    RETURN COALESCE(v_count, 0) < 3;

END;

$$
LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_chat_total_tokens()
RETURNS TRIGGER AS
$$

BEGIN
UPDATE chats
SET total_tokens = total_tokens + NEW.tokens_used
WHERE id = NEW.chat_id;
RETURN NEW;
END;

$$
LANGUAGE plpgsql;

CREATE TRIGGER update_chat_tokens
    AFTER INSERT ON messages
    FOR EACH ROW
    WHEN (NEW.tokens_used > 0)
    EXECUTE FUNCTION update_chat_total_tokens();

ALTER TABLE anonymous_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for own chats" ON chats
    FOR SELECT USING (
        user_id = auth.uid() OR
        anonymous_id IN (
            SELECT id FROM anonymous_sessions
            WHERE fingerprint = current_setting('app.fingerprint', TRUE)
        )
    );

CREATE POLICY "Enable insert for authenticated users" ON chats
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable update for own chats" ON chats
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Enable read for own chat messages" ON messages
    FOR SELECT USING (
        chat_id IN (
            SELECT id FROM chats
            WHERE user_id = auth.uid()
            OR anonymous_id IN (
                SELECT id FROM anonymous_sessions
                WHERE fingerprint = current_setting('app.fingerprint', TRUE)
            )
        )
    );

CREATE POLICY "Enable insert for own chat messages" ON messages
    FOR INSERT WITH CHECK (
        chat_id IN (
            SELECT id FROM chats
            WHERE user_id = auth.uid()
            OR anonymous_id IN (
                SELECT id FROM anonymous_sessions
                WHERE fingerprint = current_setting('app.fingerprint', TRUE)
            )
        )
    );

CREATE POLICY "Enable read for own documents" ON documents
    FOR SELECT USING (
        user_id = auth.uid() OR
        anonymous_id IN (
            SELECT id FROM anonymous_sessions
            WHERE fingerprint = current_setting('app.fingerprint', TRUE)
        )
    );

CREATE POLICY "Enable insert for own documents" ON documents
    FOR INSERT WITH CHECK (user_id = auth.uid());

ALTER TABLE chats REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;

BEGIN;
    DROP PUBLICATION IF EXISTS supabase_realtime;
    CREATE PUBLICATION supabase_realtime
        FOR TABLE chats, messages;
COMMIT;

CREATE OR REPLACE FUNCTION cleanup_old_anonymous_sessions()
RETURNS void AS
$$

BEGIN
DELETE FROM anonymous_sessions
WHERE created_at < NOW() - INTERVAL '30 days'
AND id NOT IN (SELECT DISTINCT anonymous_id FROM chats WHERE anonymous_id IS NOT NULL);
END;

$$
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_user_storage_folder()
RETURNS TRIGGER AS
$$

DECLARE
v_folder_path TEXT;
BEGIN

v_folder_path := NEW.id::text || '/';

    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('chat-documents', v_folder_path, NEW.id, '{"is_folder": true}'::jsonb);

    RETURN NEW;

EXCEPTION
WHEN OTHERS THEN

RETURN NEW;
END;

$$
LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_user_storage_after_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_storage_folder();
$$
