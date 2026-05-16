import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const SHORTCUTS_TABLE = 'admin_ai_chat_shortcuts';

export const MAX_KEYWORD_LENGTH = 40;
export const MAX_PROMPT_LENGTH = 500;

export interface AiChatShortcut {
    id: number;
    keyword: string;
    prompt: string;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface AiChatShortcutInsert {
    keyword: string;
    prompt: string;
    is_active?: boolean;
    sort_order?: number;
}

export interface AiChatShortcutUpdate {
    keyword?: string;
    prompt?: string;
    is_active?: boolean;
    sort_order?: number;
}

/** List all shortcuts ordered by sort_order then id. Optionally filter to active only. */
export async function listShortcuts(activeOnly = false): Promise<AiChatShortcut[]> {
    let q = supabaseAdmin
        .from(SHORTCUTS_TABLE)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });

    if (activeOnly) {
        q = q.eq('is_active', true);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as AiChatShortcut[];
}

export async function insertShortcut(entry: AiChatShortcutInsert): Promise<AiChatShortcut> {
    const { data, error } = await supabaseAdmin
        .from(SHORTCUTS_TABLE)
        .insert({
            keyword: entry.keyword.trim().slice(0, MAX_KEYWORD_LENGTH),
            prompt: entry.prompt.trim().slice(0, MAX_PROMPT_LENGTH),
            is_active: entry.is_active ?? true,
            sort_order: entry.sort_order ?? 0,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data as AiChatShortcut;
}

export async function updateShortcut(
    id: number,
    patch: AiChatShortcutUpdate,
): Promise<AiChatShortcut> {
    const update: Record<string, unknown> = {};
    if (patch.keyword !== undefined) update.keyword = patch.keyword.trim().slice(0, MAX_KEYWORD_LENGTH);
    if (patch.prompt !== undefined) update.prompt = patch.prompt.trim().slice(0, MAX_PROMPT_LENGTH);
    if (patch.is_active !== undefined) update.is_active = patch.is_active;
    if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;

    const { data, error } = await supabaseAdmin
        .from(SHORTCUTS_TABLE)
        .update(update)
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Shortcut not found');
    return data as AiChatShortcut;
}

export async function deleteShortcut(id: number): Promise<void> {
    const { error } = await supabaseAdmin
        .from(SHORTCUTS_TABLE)
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
}
