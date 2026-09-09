import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface JlptExplanation {
  id: string;
  title: string;
  questions: string;
  explanation: string;
  created_at: string;
}

export interface JlptExplanationFormData {
  title: string;
  questions: string;
  explanation: string;
}

const LOCAL_STORAGE_KEY = "kanji_master_jlpt_explanations";

// localStorage fallback functions
function getLocalExplanations(): JlptExplanation[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveLocalExplanations(explanations: JlptExplanation[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(explanations));
}

// Fetch all explanations
export async function fetchExplanations(): Promise<JlptExplanation[]> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from("jlpt_explanations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      throw new Error("해설 목록을 불러오는데 실패했습니다.");
    }

    return data || [];
  }

  // Fallback to localStorage
  return getLocalExplanations();
}

// Add a new explanation
export async function addExplanation(
  formData: JlptExplanationFormData
): Promise<JlptExplanation> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from("jlpt_explanations")
      .insert([formData])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      throw new Error("해설 저장에 실패했습니다.");
    }

    return data;
  }

  // Fallback to localStorage
  const explanations = getLocalExplanations();
  const newExplanation: JlptExplanation = {
    id: crypto.randomUUID(),
    ...formData,
    created_at: new Date().toISOString(),
  };
  explanations.unshift(newExplanation);
  saveLocalExplanations(explanations);
  return newExplanation;
}

// Delete an explanation
export async function deleteExplanation(id: string): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase
      .from("jlpt_explanations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase delete error:", error);
      throw new Error("해설 삭제에 실패했습니다.");
    }

    return;
  }

  // Fallback to localStorage
  const explanations = getLocalExplanations();
  const filtered = explanations.filter((e) => e.id !== id);
  saveLocalExplanations(filtered);
}
