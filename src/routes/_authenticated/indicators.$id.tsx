import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Trash2, FileText, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/indicators/$id")({
  head: () => ({ meta: [{ title: "지표 실적 입력 — ESG 지표관리" }] }),
  component: IndicatorDetailPage,
});

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 4 + i);

type Cell = { row_no: number; col_no: number; label: string; is_input: boolean };
type TableDef = { id: string; table_no: number; title: string };

function IndicatorDetailPage() {
  const { id } = Route.useParams();
  const { canEdit, isAdmin, user } = useAuth();
  const [year, setYear] = useState<number>(CURRENT_YEAR);

  const { data: indicator } = useQuery({
    queryKey: ["indicator", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicators")
        .select("*, indicator_categories(name, esg_type)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: tables } = useQuery({
    queryKey: ["ind-tables", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("indicator_tables")
        .select("id, table_no, title")
        .eq("indicator_id", id)
        .order("sort_order");
      return (data ?? []) as TableDef[];
    },
  });

  if (!indicator) {
    return <div className="text-sm text-muted-foreground">불러오는 중...</div>;
  }

  const cat = indicator.indicator_categories as { name: string; esg_type: string } | null;
  const isExcluded = indicator.input_method === "excluded";
  const isQuant = indicator.type === "quantitative";

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/indicators"><ArrowLeft className="size-4 mr-1" />목록</Link>
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">{indicator.code}</span>
              {cat && <Badge variant="outline">{cat.esg_type}</Badge>}
              <Badge variant="secondary">{isQuant ? "계량" : "비계량"}</Badge>
              {indicator.department && <Badge variant="outline">{indicator.department}</Badge>}
              {indicator.cycle && <Badge variant="outline">{indicator.cycle}</Badge>}
              {isExcluded && <Badge variant="destructive">관리 제외</Badge>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{indicator.name}</h1>
            {indicator.writing_guide && (
              <details className="text-sm text-muted-foreground mt-2 max-w-3xl">
                <summary className="cursor-pointer hover:text-foreground">작성 가이드</summary>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{indicator.writing_guide}</p>
              </details>
            )}
            {indicator.guideline_ref && (
              <p className="text-xs text-muted-foreground mt-1">근거: {indicator.guideline_ref}</p>
            )}
          </div>
          {!isExcluded && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">기준 연도</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {isExcluded && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">관리 제외 지표</CardTitle>
            <CardDescription>{indicator.excluded_reason}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isExcluded && (tables ?? []).map((t) => (
        <TableEditor key={t.id} table={t} year={year} canEdit={canEdit} userId={user?.id ?? null} />
      ))}

      {!isExcluded && (tables ?? []).length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">표 입력 항목 없음</CardTitle>
            <CardDescription>
              이 지표는 정성 서술 또는 파일 업로드 중심으로 관리합니다.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isExcluded && isQuant && (tables ?? []).length > 0 && (
        <TemplateIO indicatorId={id} code={indicator.code} name={indicator.name} year={year} canEdit={canEdit} userId={user?.id ?? null} />
      )}

      {!isExcluded && (
        <NarrativeEditor indicatorId={id} year={year} canEdit={canEdit} userId={user?.id ?? null} />
      )}
      {!isExcluded && (
        <AttachmentsPanel indicatorId={id} canEdit={canEdit} isAdmin={isAdmin} userId={user?.id ?? null} />
      )}
    </div>
  );
}

function TableEditor({ table, year, canEdit, userId }: { table: TableDef; year: number; canEdit: boolean; userId: string | null }) {
  const { data: cells } = useQuery({
    queryKey: ["cells", table.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("indicator_table_cells_schema")
        .select("row_no, col_no, label, is_input")
        .eq("table_id", table.id);
      return (data ?? []) as Cell[];
    },
  });

  const { data: values, refetch } = useQuery({
    queryKey: ["values", table.id, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("indicator_table_values")
        .select("row_no, col_no, numeric_value, text_value")
        .eq("table_id", table.id)
        .eq("period_year", year);
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`tv-${table.id}-${year}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "indicator_table_values", filter: `table_id=eq.${table.id}` },
        () => refetch(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [table.id, year, refetch]);

  const { grid, maxRow, maxCol } = useMemo(() => {
    const map = new Map<string, Cell>();
    let mr = 0, mc = 0;
    for (const c of cells ?? []) {
      map.set(`${c.row_no}|${c.col_no}`, c);
      if (c.row_no > mr) mr = c.row_no;
      if (c.col_no > mc) mc = c.col_no;
    }
    const valMap = new Map<string, string>();
    for (const v of values ?? []) {
      valMap.set(`${v.row_no}|${v.col_no}`, v.numeric_value != null ? String(v.numeric_value) : (v.text_value ?? ""));
    }
    return { grid: { schema: map, vals: valMap }, maxRow: mr, maxCol: mc };
  }, [cells, values]);

  const queryClient = useQueryClient();
  const save = async (row_no: number, col_no: number, raw: string) => {
    const num = raw.trim() === "" ? null : Number(raw);
    const isNum = num !== null && !Number.isNaN(num);
    const payload = {
      table_id: table.id,
      period_year: year,
      row_no,
      col_no,
      numeric_value: isNum ? num : null,
      text_value: isNum ? null : (raw.trim() === "" ? null : raw),
      updated_by: userId,
    };
    const { error } = await supabase
      .from("indicator_table_values")
      .upsert(payload, { onConflict: "table_id,period_year,row_no,col_no" });
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  if (!cells) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">표 {table.table_no}. {table.title}</CardTitle>
        <CardDescription>{year}년 기준 · 셀을 클릭해 값을 입력하고 포커스를 벗어나면 자동 저장됩니다.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="border-collapse text-sm w-full min-w-max">
          <tbody>
            {Array.from({ length: maxRow }, (_, ri) => ri + 1).map((r) => (
              <tr key={r}>
                {Array.from({ length: maxCol }, (_, ci) => ci + 1).map((c) => {
                  const cell = grid.schema.get(`${r}|${c}`);
                  const v = grid.vals.get(`${r}|${c}`) ?? "";
                  if (cell && !cell.is_input) {
                    return (
                      <td key={c} className="border border-border bg-muted/40 px-3 py-2 font-medium text-foreground whitespace-pre-wrap">
                        {cell.label}
                      </td>
                    );
                  }
                  return (
                    <td key={c} className="border border-border p-0 min-w-[100px]">
                      <CellInput
                        initial={v}
                        placeholder={cell.label}
                        disabled={!canEdit}
                        onSave={(val) => save(r, c, val)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CellInput({ initial, placeholder, disabled, onSave }: { initial: string; placeholder: string; disabled: boolean; onSave: (v: string) => void }) {
  const [val, setVal] = useState(initial);
  useEffect(() => setVal(initial), [initial]);
  return (
    <Input
      value={val}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { if (val !== initial) onSave(val); }}
      className="border-0 rounded-none focus-visible:ring-1 focus-visible:ring-ring h-9"
    />
  );
}

function NarrativeEditor({ indicatorId, year, canEdit, userId }: { indicatorId: string; year: number; canEdit: boolean; userId: string | null }) {
  const { data: narr, refetch } = useQuery({
    queryKey: ["narr", indicatorId, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("indicator_narratives")
        .select("content")
        .eq("indicator_id", indicatorId)
        .eq("period_year", year)
        .is("period_quarter", null)
        .maybeSingle();
      return data?.content ?? "";
    },
  });
  const [val, setVal] = useState("");
  useEffect(() => { setVal(narr ?? ""); }, [narr]);

  useEffect(() => {
    const ch = supabase
      .channel(`narr-${indicatorId}-${year}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "indicator_narratives", filter: `indicator_id=eq.${indicatorId}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [indicatorId, year, refetch]);

  const queryClient = useQueryClient();
  const save = async () => {
    const { data: existing, error: selErr } = await supabase
      .from("indicator_narratives")
      .select("id")
      .eq("indicator_id", indicatorId)
      .eq("period_year", year)
      .is("period_quarter", null)
      .limit(1)
      .maybeSingle();
    if (selErr) { toast.error(selErr.message); return; }
    let error;
    if (existing) {
      ({ error } = await supabase
        .from("indicator_narratives")
        .update({ content: val, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("indicator_narratives")
        .insert({ indicator_id: indicatorId, period_year: year, period_quarter: null, content: val, updated_by: userId }));
    }
    if (error) toast.error(error.message);
    else {
      toast.success("저장되었습니다");
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">정성 서술 ({year}년)</CardTitle>
        <CardDescription>작성 가이드에 따라 활동내용·성과·이슈 등을 자유롭게 기재합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea rows={6} value={val} disabled={!canEdit} onChange={(e) => setVal(e.target.value)} placeholder="서술 내용을 입력하세요..." />
        {canEdit && (
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={val === (narr ?? "")}>저장</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttachmentsPanel({ indicatorId, canEdit, isAdmin, userId }: { indicatorId: string; canEdit: boolean; isAdmin: boolean; userId: string | null }) {
  const queryClient = useQueryClient();
  const { data: files, refetch } = useQuery({
    queryKey: ["att", indicatorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("indicator_attachments")
        .select("*")
        .eq("indicator_id", indicatorId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`att-${indicatorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "indicator_attachments", filter: `indicator_id=eq.${indicatorId}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [indicatorId, refetch]);

  const upload = async (file: File) => {
    const path = `${indicatorId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("indicator-files").upload(path, file);
    if (upErr) { toast.error(upErr.message); return; }
    const { error } = await supabase.from("indicator_attachments").insert({
      indicator_id: indicatorId,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userId,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`${file.name} 업로드 완료`);
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    }
  };

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("indicator-files").createSignedUrl(path, 60);
    if (error || !data) { toast.error("다운로드 실패"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.click();
  };

  const remove = async (fileId: string, path: string) => {
    if (!confirm("이 파일을 삭제하시겠습니까?")) return;
    await supabase.storage.from("indicator-files").remove([path]);
    await supabase.from("indicator_attachments").delete().eq("id", fileId);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">증빙 / 첨부파일</CardTitle>
          <CardDescription>관련 문서, 보고서, 사진 등을 업로드합니다.</CardDescription>
        </div>
        {canEdit && (
          <label className="inline-flex">
            <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            <Button size="sm" asChild><span><Upload className="size-4 mr-1" />파일 업로드</span></Button>
          </label>
        )}
      </CardHeader>
      <CardContent>
        {(files ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">업로드된 파일이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {files!.map((f) => (
              <li key={f.id} className="flex items-center gap-3 border rounded-md px-3 py-2">
                <FileText className="size-4 text-muted-foreground" />
                <button onClick={() => download(f.storage_path, f.file_name)} className="text-sm hover:underline text-left flex-1 truncate">{f.file_name}</button>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(f.created_at).toLocaleDateString("ko-KR")}</span>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => remove(f.id, f.storage_path)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function sanitizeSheetName(s: string) {
  return s.replace(/[\\\/\?\*\[\]:]/g, " ").slice(0, 28).trim() || "Sheet";
}

function TemplateIO({ indicatorId, code, name, year, canEdit, userId }: { indicatorId: string; code: string; name: string; year: number; canEdit: boolean; userId: string | null }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const fetchSchema = async () => {
    const { data: tables, error: tErr } = await supabase
      .from("indicator_tables")
      .select("id, table_no, title")
      .eq("indicator_id", indicatorId)
      .order("sort_order");
    if (tErr || !tables) throw new Error(tErr?.message ?? "표 정보 조회 실패");

    const tableIds = tables.map((t) => t.id);
    const [{ data: cells }, { data: vals }] = await Promise.all([
      supabase.from("indicator_table_cells_schema").select("table_id, row_no, col_no, label, is_input").in("table_id", tableIds),
      supabase.from("indicator_table_values").select("table_id, row_no, col_no, numeric_value, text_value").in("table_id", tableIds).eq("period_year", year),
    ]);
    return { tables, cells: cells ?? [], vals: vals ?? [] };
  };

  const downloadTemplate = async (withValues: boolean) => {
    setBusy(true);
    try {
      const { tables, cells, vals } = await fetchSchema();
      const wb = XLSX.utils.book_new();
      const usedNames = new Set<string>();
      for (const t of tables) {
        const tCells = cells.filter((c) => c.table_id === t.id);
        const tVals = vals.filter((v) => v.table_id === t.id);
        if (tCells.length === 0) continue;
        const maxRow = Math.max(...tCells.map((c) => c.row_no));
        const maxCol = Math.max(...tCells.map((c) => c.col_no));
        // Build AOA: row 1 = header band
        const aoa: (string | number | null)[][] = [];
        aoa.push([`[${code}] ${name} — 표 ${t.table_no}. ${t.title} (${year}년)`]);
        aoa.push([]); // spacer
        const rowOffset = 2; // grid starts at sheet row index 2 (0-based)
        for (let r = 1; r <= maxRow; r++) {
          const rowArr: (string | number | null)[] = [];
          for (let c = 1; c <= maxCol; c++) {
            const cell = tCells.find((x) => x.row_no === r && x.col_no === c);
            if (!cell) { rowArr.push(null); continue; }
            if (!cell.is_input) { rowArr.push(cell.label); continue; }
            if (withValues) {
              const v = tVals.find((x) => x.row_no === r && x.col_no === c);
              rowArr.push(v ? (v.numeric_value ?? v.text_value ?? null) : null);
            } else {
              rowArr.push(null);
            }
          }
          aoa.push(rowArr);
        }
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        // Column widths
        ws["!cols"] = Array.from({ length: maxCol }, () => ({ wch: 18 }));
        let base = sanitizeSheetName(`T${t.table_no}_${t.title}`);
        let nm = base;
        let i = 2;
        while (usedNames.has(nm)) { nm = `${base.slice(0, 25)}_${i++}`; }
        usedNames.add(nm);
        XLSX.utils.book_append_sheet(wb, ws, nm);
      }
      if (wb.SheetNames.length === 0) {
        toast.error("다운로드할 표 양식이 없습니다");
        return;
      }
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
      const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${code}_${year}_${withValues ? "현황" : "양식"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("다운로드를 시작합니다");
    } catch (e) {
      toast.error("양식 다운로드 실패", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="size-4" />입력값 엑셀 다운로드
        </CardTitle>
        <CardDescription>
          위 표에 직접 값을 입력하세요. 입력된 값은 엑셀로 내려받을 수 있습니다. ({year}년)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => downloadTemplate(false)}>
            <Download className="size-4 mr-1" />빈 양식
          </Button>
          <Button size="sm" disabled={busy} onClick={() => downloadTemplate(true)}>
            <Download className="size-4 mr-1" />입력값 다운로드
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
