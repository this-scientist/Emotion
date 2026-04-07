create extension if not exists pgcrypto;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.folders (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  parent_id uuid null,
  name text not null,
  color text null default '#6366F1'::text,
  description text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint folders_pkey primary key (id),
  constraint folders_parent_id_fkey foreign key (parent_id) references public.folders (id) on delete cascade,
  constraint folders_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
) tablespace pg_default;

create trigger update_folders_updated_at
before update on public.folders
for each row
execute function public.update_updated_at();

create table public.profiles (
  id uuid not null,
  username text null,
  display_name text null,
  avatar_url text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_username_key unique (username),
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
) tablespace pg_default;

create trigger update_profiles_updated_at
before update on public.profiles
for each row
execute function public.update_updated_at();

create table public.user_files (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  folder_id uuid null,
  file_name text not null,
  original_name text not null,
  file_content text null,
  file_meta jsonb null,
  blocks_data jsonb null,
  mappings_data jsonb null,
  analysis_data jsonb null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_files_pkey primary key (id),
  constraint user_files_folder_id_fkey foreign key (folder_id) references public.folders (id) on delete set null,
  constraint user_files_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
) tablespace pg_default;

create trigger update_files_updated_at
before update on public.user_files
for each row
execute function public.update_updated_at();
