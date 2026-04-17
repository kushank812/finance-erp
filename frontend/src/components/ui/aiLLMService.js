import { apiPost } from "../../api/client";

export async function interpretWithLLM(query) {
  try {
    const res = await apiPost("/ai/interpret", {
      query,
    });

    return res;
  } catch {
    return null;
  }
}