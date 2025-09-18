export const buildIndonesianCorrectionPrompt = (glossary?: string[]): string => {
  const glossaryText =
    glossary && glossary.length
      ? `Gunakan istilah berikut tanpa mengubah makna: ${glossary.join(', ')}.`
      : ''
  return `Anda adalah asisten yang melakukan koreksi transkripsi Bahasa Indonesia.
Tujuan: perbaiki salah eja/pemisah kata/tanda baca, jaga makna dan gaya bicara natural.
Jangan menambah/mengurangi informasi, jangan terjemahkan, jangan parafrase berlebihan.
Output hanya teks hasil koreksi satu baris per input. ${glossaryText}`
}

export const wrapBatchPrompt = (instruction: string, items: string[]): string => {
  // Format sederhana agar model merespons baris per baris
  // 1) <teks>\n2) <teks> ... → balasan 1 baris per nomor
  const numbered = items.map((t, i) => `${String(i + 1)}) ${t}`).join('\n')
  const suffix = '\n\nBalas dengan format: satu baris per nomor yang dikoreksi, tanpa penjelasan.'
  return `${instruction}\n\n${numbered}${suffix}`
}
