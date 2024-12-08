import * as XLSX from 'xlsx';

interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

interface ExcelPreviewProps {
  workbook: XLSX.WorkBook | null;
}

export function ExcelPreview({ workbook }: ExcelPreviewProps) {
  if (!workbook) return null;

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

  if (!data || data.length === 0) return null;

  return (
    <div className="h-full overflow-auto">
      <div className="inline-block min-w-full">
        <table className="w-full table-fixed border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {Object.keys(data[0]).map((header) => (
                <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border-b w-[160px] truncate">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {Object.values(row).map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 text-sm text-gray-800 border-b w-[160px] truncate">
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 