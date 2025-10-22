export function extractJson(text: string): string {
  // ```json ... ``` または ``` ... ``` の中身を優先的に抽出
  const fencedJson = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJson?.[1]) return fencedJson[1].trim();
  const fenced = text.match(/```\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  return text.trim();
}

