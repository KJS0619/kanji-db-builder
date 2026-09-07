import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { CustomWord, WordFormData } from "@/types/word";

const LOCAL_STORAGE_KEY = "kanji_master_custom_words";

// localStorage fallback functions
function getLocalWords(): CustomWord[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveLocalWords(words: CustomWord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(words));
}

// Fetch all words
export async function fetchWords(): Promise<CustomWord[]> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from("custom_words")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      throw new Error("단어 목록을 불러오는데 실패했습니다.");
    }

    return data || [];
  }

  // Fallback to localStorage
  return getLocalWords();
}

// Add a new word
export async function addWord(wordData: WordFormData): Promise<CustomWord> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from("custom_words")
      .insert([wordData])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      throw new Error("단어 추가에 실패했습니다.");
    }

    return data;
  }

  // Fallback to localStorage
  const words = getLocalWords();
  const newWord: CustomWord = {
    id: crypto.randomUUID(),
    ...wordData,
    created_at: new Date().toISOString(),
  };
  words.unshift(newWord);
  saveLocalWords(words);
  return newWord;
}

// Delete a word
export async function deleteWord(id: string): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase
      .from("custom_words")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase delete error:", error);
      throw new Error("단어 삭제에 실패했습니다.");
    }

    return;
  }

  // Fallback to localStorage
  const words = getLocalWords();
  const filtered = words.filter((w) => w.id !== id);
  saveLocalWords(filtered);
}

// Update a word
export async function updateWord(
  id: string,
  wordData: Partial<WordFormData>
): Promise<CustomWord> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from("custom_words")
      .update(wordData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      throw new Error("단어 수정에 실패했습니다.");
    }

    return data;
  }

  // Fallback to localStorage
  const words = getLocalWords();
  const index = words.findIndex((w) => w.id === id);
  if (index !== -1) {
    words[index] = { ...words[index], ...wordData };
    saveLocalWords(words);
    return words[index];
  }
  throw new Error("단어를 찾을 수 없습니다.");
}
