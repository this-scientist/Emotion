alter table public.user_files
  alter column file_content type jsonb
  using case
    when file_content is null then null
    else jsonb_build_object('legacy_plaintext', file_content)
  end;

create table if not exists public.user_encryption_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dek_id uuid not null default gen_random_uuid(),
  wrapped_dek jsonb not null,
  kek_version integer not null default 1,
  status text not null default 'active' check (status in ('active', 'rotated', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
) tablespace pg_default;

alter table public.user_encryption_keys enable row level security;

revoke all on public.user_encryption_keys from anon, authenticated;

create trigger update_user_encryption_keys_updated_at
before update on public.user_encryption_keys
for each row
execute function public.update_updated_at();
