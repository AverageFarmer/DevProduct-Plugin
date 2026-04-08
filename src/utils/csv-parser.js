export function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { success: false, error: 'File is empty', products: [] };
  }

  // Detect if first line is a header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('name') || firstLine.includes('price');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const products = [];
  const errors = [];

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = hasHeader ? i + 2 : i + 1;
    const parts = splitCSVLine(dataLines[i]);

    if (parts.length < 2) {
      errors.push(`Line ${lineNum}: Need at least name and price`);
      continue;
    }

    const name = parts[0].trim();
    const price = parseInt(parts[1].trim(), 10);
    const description = parts[2] ? parts[2].trim() : '';

    if (!name) {
      errors.push(`Line ${lineNum}: Empty name`);
      continue;
    }
    if (isNaN(price) || price <= 0) {
      errors.push(`Line ${lineNum}: Invalid price "${parts[1].trim()}"`);
      continue;
    }

    products.push({ name, price, description: description || undefined });
  }

  return {
    success: true,
    products,
    errors,
    totalLines: dataLines.length,
  };
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
