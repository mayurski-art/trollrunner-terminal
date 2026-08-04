-- Gossip messages (owner-only, see lib/persona.ts maybeGenerateGossip) and
-- persona-sent images (see lib/loreAssets.ts) both ride on the existing
-- terminal_chat_messages table rather than new tables.
alter table terminal_chat_messages add column if not exists is_gossip boolean not null default false;
alter table terminal_chat_messages add column if not exists image_url text;
alter table terminal_chat_messages add column if not exists image_caption text;
