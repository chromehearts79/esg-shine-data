import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload as UploadIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "엑셀 업로드 — ESG 지표관리" }] }),
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

type ValueRow = {
  indicator_code: string;
  period_year: number;
  period_quarter?: number | null;
  numeric_value?: number | null;
  text_value?: string | null;
  source?: string;
  note?: string;
};

function UploadPage() {
  const { isAdmin, canEdit } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">엑셀 업로드</h1>
        <p className="text-muted-foreground text-sm mt-1">템플릿을 다운받아 작성한 뒤 업로드하세요. 입력 즉시 모두에게 반영됩니다.</p>
      </div>
      <Tabs defaultValue="values">
        <TabsList>
          <TabsTrigger value="values">지표 값</TabsTrigger>
          <TabsTrigger value="indicators" disabled={!isAdmin}>지표 마스터 {!isAdmin && "(관리자)"}</TabsTrigger>
        </TabsList>
        <TabsContent value="values">
          {canEdit ? <ValuesUpload /> : <PermissionDenied />}
        </TabsContent>
        <TabsContent value="indicators">
          {isAdmin ? <IndicatorsUpload /> : <PermissionDenied />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PermissionDenied() {
  return (
    <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">권한이 없습니다. 관리자에게 권한을 요청하세요.</CardContent></Card>
  );
}

function downloadXlsx(rows: Record<string, unknown>[], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

function ValuesUpload() {
  const [rows, setRows] = useState<ValueRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    downloadXlsx([
      { indicator_code: "E-2-1", period_year: 2024, period_quarter: "", numeric_value: 12345.6, text_value: "", source: "ESG보고서 p.10", note: "" },
      { indicator_code: "G-1-1", period_year: 2024, period_quarter: 1, numeric_value: "", text_value: "이사회 5인 구성", source: "", note: "" },
    ], "esg_values_template.xlsx", "values");
  };

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    const errs: string[] = [];
    const parsed: ValueRow[] = json.map((r, idx) => {
      const code = String(r.indicator_code ?? "").trim();
      const year = Number(r.period_year);
      const qRaw = r.period_quarter;
      const quarter = qRaw === "" || qRaw === null || qRaw === undefined ? null : Number(qRaw);
      const num = r.numeric_value === "" || r.numeric_value == null ? null : Number(r.numeric_value);
      const txt = String(r.text_value ?? "").trim() || null;
      if (!code) errs.push(`행 ${idx + 2}: indicator_code 누락`);
      if (!Number.isFinite(year)) errs.push(`행 ${idx + 2}: period_year가 숫자가 아님`);
      if (quarter !== null && (quarter < 1 || quarter > 4)) errs.push(`행 ${idx + 2}: period_quarter는 1~4`);
      if (num === null && !txt) errs.push(`행 ${idx + 2}: numeric_value 또는 text_value 중 하나는 필수`);
      return {
        indicator_code: code,
        period_year: year,
        period_quarter: quarter,
        numeric_value: num,
        text_value: txt,
        source: String(r.source ?? "").trim() || undefined,
        note: String(r.note ?? "").trim() || undefined,
      };
    });
    setRows(parsed);
    setErrors(errs);
  };

  const handleImport = async () => {
    if (errors.length || rows.length === 0) return;
    setBusy(true);
    const codes = Array.from(new Set(rows.map((r) => r.indicator_code)));
    const { data: inds, error: indErr } = await supabase.from("indicators").select("id, code").in("code", codes);
    if (indErr) { toast.error(indErr.message); setBusy(false); return; }
    const indMap = new Map((inds ?? []).map((i) => [i.code, i.id]));
    const missing = codes.filter((c) => !indMap.has(c));
    if (missing.length) {
      toast.error("등록되지 않은 지표 코드", { description: missing.join(", ") });
      setBusy(false);
      return;
    }
    const payload = rows.map((r) => ({
      indicator_id: indMap.get(r.indicator_code)!,
      period_year: r.period_year,
      period_quarter: r.period_quarter,
      numeric_value: r.numeric_value,
      text_value: r.text_value,
      source: r.source ?? null,
      note: r.note ?? null,
    }));
    const { error } = await supabase
      .from("indicator_values")
      .upsert(payload, { onConflict: "indicator_id,period_year,period_quarter" });
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
        <CardTitle className="text-base">지표 값 업로드</CardTitle>
        <CardDescription>지표 코드별로 연도/분기 값을 일괄 입력합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate}><Download className="size-4 mr-1" />템플릿 다운로드</Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
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
            {errors.length > 10 && <p className="text-xs text-muted-foreground">외 {errors.length - 10}건...</p>}
          </div>
        )}

        {rows.length > 0 && (
          <div className="border rounded-md">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b flex items-center gap-1">
              {errors.length === 0 && <CheckCircle2 className="size-4 text-green-600" />}
              미리보기 (총 {rows.length}행, 상위 20행)
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>지표코드</TableHead>
                  <TableHead>연도</TableHead>
                  <TableHead>분기</TableHead>
                  <TableHead>값(숫자)</TableHead>
                  <TableHead>값(텍스트)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 20).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.indicator_code}</TableCell>
                    <TableCell>{r.period_year}</TableCell>
                    <TableCell>{r.period_quarter ?? "연간"}</TableCell>
                    <TableCell>{r.numeric_value ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{r.text_value ?? "—"}</TableCell>
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
