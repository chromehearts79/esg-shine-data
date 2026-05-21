import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload as UploadIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "지표 마스터 업로드 — ESG 지표관리" }] }),
  component: UploadPage,
});

type IndicatorRow = {
  category_code: string;
  code: string;
  name: string;
  type: string;
  unit?: string;
  description?: string;
};

function UploadPage() {
  const { isAdmin } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">지표 마스터 일괄 업로드 (관리자 전용)</h1>
        <p className="text-muted-foreground text-sm mt-1">지표 정의(코드/이름/유형/단위)를 엑셀로 일괄 등록합니다.</p>
      </div>
      {isAdmin ? <IndicatorsUpload /> : (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">권한이 없습니다. 관리자에게 권한을 요청하세요.</CardContent></Card>
      )}
    </div>
  );
}

function downloadXlsx(rows: Record<string, unknown>[], filename: string, sheetName = "Sheet1") {
  try {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("템플릿 다운로드 시작");
  } catch (e) {
    toast.error("템플릿 다운로드 실패", { description: (e as Error).message });
  }
}

function IndicatorsUpload() {
  const [rows, setRows] = useState<IndicatorRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    downloadXlsx([
      { category_code: "E-2", code: "E-2-1", name: "온실가스 직접 배출량(Scope 1)", type: "quantitative", unit: "tCO2eq", description: "사업장 직접 배출량" },
      { category_code: "G-1", code: "G-1-1", name: "이사회 구성 현황", type: "qualitative", unit: "", description: "이사회 인원 및 다양성" },
    ], "esg_indicators_template.xlsx", "indicators");
  };

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    const errs: string[] = [];
    const parsed: IndicatorRow[] = json.map((r, idx) => {
      const code = String(r.code ?? "").trim();
      const name = String(r.name ?? "").trim();
      const type = String(r.type ?? "quantitative").trim();
      if (!code) errs.push(`행 ${idx + 2}: code 누락`);
      if (!name) errs.push(`행 ${idx + 2}: name 누락`);
      if (!["quantitative", "qualitative"].includes(type)) errs.push(`행 ${idx + 2}: type은 quantitative/qualitative`);
      return {
        category_code: String(r.category_code ?? "").trim(),
        code, name, type,
        unit: String(r.unit ?? "").trim() || undefined,
        description: String(r.description ?? "").trim() || undefined,
      };
    });
    setRows(parsed);
    setErrors(errs);
  };

  const handleImport = async () => {
    if (errors.length || rows.length === 0) return;
    setBusy(true);
    const catCodes = Array.from(new Set(rows.map((r) => r.category_code).filter(Boolean)));
    const { data: cats } = await supabase.from("indicator_categories").select("id, code").in("code", catCodes);
    const catMap = new Map((cats ?? []).map((c) => [c.code, c.id]));
    const payload = rows.map((r) => ({
      code: r.code,
      name: r.name,
      type: r.type as "quantitative" | "qualitative",
      unit: r.unit ?? null,
      description: r.description ?? null,
      category_id: r.category_code ? catMap.get(r.category_code) ?? null : null,
      is_active: true,
    }));
    const { error } = await supabase.from("indicators").upsert(payload, { onConflict: "code" });
    setBusy(false);
    if (error) toast.error("업로드 실패", { description: error.message });
    else {
      toast.success(`${payload.length}건 저장되었습니다`);
      setRows([]);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">지표 마스터 업로드</CardTitle>
        <CardDescription>지표 정의(코드, 이름, 유형, 단위)를 일괄 등록합니다. 같은 code면 덮어씁니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate}><Download className="size-4 mr-1" />템플릿 다운로드</Button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <Button onClick={() => inputRef.current?.click()}><UploadIcon className="size-4 mr-1" />파일 선택</Button>
          {rows.length > 0 && errors.length === 0 && (
            <Button onClick={handleImport} disabled={busy} className="ml-auto">
              {busy ? "저장 중..." : `${rows.length}건 저장`}
            </Button>
          )}
        </div>

        {errors.length > 0 && (
          <div className="border rounded-md p-3 bg-destructive/5 text-sm space-y-1">
            <div className="font-medium text-destructive flex items-center gap-1"><AlertCircle className="size-4" />검증 오류 {errors.length}건</div>
            <ul className="text-xs list-disc pl-5">{errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        {rows.length > 0 && (
          <div className="border rounded-md">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">미리보기 ({rows.length}행)</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>카테고리</TableHead>
                  <TableHead>코드</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>단위</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 20).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.category_code || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{r.type === "quantitative" ? "계량" : "비계량"}</Badge></TableCell>
                    <TableCell className="text-xs">{r.unit || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
