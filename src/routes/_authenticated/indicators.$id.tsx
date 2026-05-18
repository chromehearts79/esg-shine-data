import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/indicators/$id")({
  head: () => ({ meta: [{ title: "지표 상세 — ESG 지표관리" }] }),
  component: IndicatorDetailPage,
});

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 4 + i);

function IndicatorDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { canEdit, isAdmin } = useAuth();

  const { data: indicator } = useQuery({
    queryKey: ["indicator", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("indicators")
        .select("*, indicator_categories(name, esg_type)")
        .eq("id", id)
        .single();
      return data;
    },
  });

  const { data: values, refetch: refetchValues } = useQuery({
    queryKey: ["indicator-values", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("indicator_values")
        .select("*")
        .eq("indicator_id", id)
        .order("period_year", { ascending: false })
        .order("period_quarter", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`values-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "indicator_values", filter: `indicator_id=eq.${id}` },
        () => refetchValues(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, refetchValues]);

  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [quarter, setQuarter] = useState<string>("annual");
  const [numericValue, setNumericValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isQuant = indicator?.type === "quantitative";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!indicator) return;
    setSubmitting(true);
    const payload = {
      indicator_id: id,
      period_year: year,
      period_quarter: quarter === "annual" ? null : Number(quarter),
      numeric_value: isQuant && numericValue !== "" ? Number(numericValue) : null,
      text_value: !isQuant ? textValue || null : null,
      source: source || null,
      note: note || null,
    };
    const { error } = await supabase
      .from("indicator_values")
      .upsert(payload, { onConflict: "indicator_id,period_year,period_quarter" });
    setSubmitting(false);
    if (error) {
      toast.error("저장 실패", { description: error.message });
      return;
    }
    toast.success("저장되었습니다");
    setNumericValue("");
    setTextValue("");
    setSource("");
    setNote("");
  };

  const handleDelete = async (valueId: string) => {
    if (!confirm("이 데이터를 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("indicator_values").delete().eq("id", valueId);
    if (error) toast.error(error.message);
    else toast.success("삭제되었습니다");
  };

  if (!indicator) {
    return <div className="text-sm text-muted-foreground">불러오는 중...</div>;
  }

  const cat = indicator.indicator_categories as { name: string; esg_type: string } | null;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/indicators"><ArrowLeft className="size-4 mr-1" />목록</Link>
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-muted-foreground">{indicator.code}</span>
              {cat && <Badge variant="outline">{cat.esg_type} · {cat.name}</Badge>}
              <Badge variant="secondary">{indicator.type === "quantitative" ? "계량" : "비계량"}</Badge>
              {indicator.unit && <Badge variant="outline">단위: {indicator.unit}</Badge>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{indicator.name}</h1>
            {indicator.description && <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{indicator.description}</p>}
          </div>
        </div>
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">데이터 입력 / 수정</CardTitle>
            <CardDescription>
              같은 연도·분기 데이터가 있으면 덮어씁니다. 저장 즉시 모두에게 반영됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>연도</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>주기</Label>
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">연간</SelectItem>
                    <SelectItem value="1">1분기</SelectItem>
                    <SelectItem value="2">2분기</SelectItem>
                    <SelectItem value="3">3분기</SelectItem>
                    <SelectItem value="4">4분기</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isQuant ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>값 {indicator.unit && <span className="text-muted-foreground">({indicator.unit})</span>}</Label>
                  <Input type="number" step="any" value={numericValue} onChange={(e) => setNumericValue(e.target.value)} required />
                </div>
              ) : (
                <div className="space-y-2 md:col-span-2">
                  <Label>내용</Label>
                  <Textarea rows={4} value={textValue} onChange={(e) => setTextValue(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label>출처</Label>
                <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="예: 2024 ESG 보고서 p.12" />
              </div>
              <div className="space-y-2">
                <Label>비고</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? "저장 중..." : "저장"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">입력된 데이터</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>기간</TableHead>
                <TableHead>{isQuant ? "값" : "내용"}</TableHead>
                <TableHead>출처</TableHead>
                <TableHead>비고</TableHead>
                <TableHead>업데이트</TableHead>
                {isAdmin && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(values ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                    아직 입력된 데이터가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                values!.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{v.period_year}년 {v.period_quarter ? `${v.period_quarter}분기` : "연간"}</TableCell>
                    <TableCell className="max-w-md">
                      {isQuant
                        ? v.numeric_value !== null
                          ? `${Number(v.numeric_value).toLocaleString("ko-KR")}${indicator.unit ? " " + indicator.unit : ""}`
                          : "—"
                        : <span className="whitespace-pre-wrap text-sm">{v.text_value}</span>}
                    </TableCell>
                    <TableCell className="text-xs">{v.source || "—"}</TableCell>
                    <TableCell className="text-xs">{v.note || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(v.updated_at).toLocaleString("ko-KR")}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
