import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/indicators")({
  head: () => ({ meta: [{ title: "지표 마스터 관리 — ESG 지표관리" }] }),
  component: AdminIndicatorsPage,
});

function AdminIndicatorsPage() {
  const { isAdmin } = useAuth();
  const { data, refetch } = useQuery({
    queryKey: ["admin-indicators"],
    queryFn: async () => {
      const [{ data: cats }, { data: inds }] = await Promise.all([
        supabase.from("indicator_categories").select("*").order("sort_order"),
        supabase.from("indicators").select("*, indicator_categories(name, esg_type)").order("code"),
      ]);
      return { categories: cats ?? [], indicators: inds ?? [] };
    },
  });

  const [form, setForm] = useState({
    code: "", name: "", category_id: "", type: "quantitative", unit: "", description: "",
  });
  const [adding, setAdding] = useState(false);

  if (!isAdmin) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">관리자만 접근할 수 있습니다.</CardContent></Card>;
  }

  const add = async () => {
    if (!form.code || !form.name) { toast.error("코드와 이름은 필수입니다"); return; }
    setAdding(true);
    const { error } = await supabase.from("indicators").insert({
      code: form.code,
      name: form.name,
      category_id: form.category_id || null,
      type: form.type as "quantitative" | "qualitative",
      unit: form.unit || null,
      description: form.description || null,
    });
    setAdding(false);
    if (error) toast.error(error.message);
    else {
      toast.success("추가되었습니다");
      setForm({ code: "", name: "", category_id: "", type: "quantitative", unit: "", description: "" });
      refetch();
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("indicators").update({ is_active: !current }).eq("id", id);
    refetch();
  };
  const remove = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까? 관련 데이터도 함께 삭제됩니다.")) return;
    const { error } = await supabase.from("indicators").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("삭제되었습니다"); refetch(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">지표 마스터 관리</h1>
        <p className="text-muted-foreground text-sm mt-1">지표 정의를 직접 등록·수정합니다. 대량 등록은 엑셀 업로드를 사용하세요.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">새 지표 추가</CardTitle>
          <CardDescription>코드는 중복될 수 없습니다.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1 md:col-span-1">
            <Label>코드 *</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="E-2-1" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>이름 *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>카테고리</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent>
                {(data?.categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.esg_type} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>유형</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quantitative">계량</SelectItem>
                <SelectItem value="qualitative">비계량</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>단위</Label>
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="tCO2eq" />
          </div>
          <div className="space-y-1 md:col-span-6">
            <Label>설명</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="md:col-span-6">
            <Button onClick={add} disabled={adding}><Plus className="size-4 mr-1" />추가</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">등록된 지표 ({data?.indicators.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">코드</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>활성</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.indicators ?? []).map((i) => {
                const cat = i.indicator_categories as { name: string; esg_type: string } | null;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.code}</TableCell>
                    <TableCell>{i.name}</TableCell>
                    <TableCell className="text-xs">{cat ? `${cat.esg_type} · ${cat.name}` : "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{i.type === "quantitative" ? "계량" : "비계량"}</Badge></TableCell>
                    <TableCell><Switch checked={i.is_active} onCheckedChange={() => toggleActive(i.id, i.is_active)} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => remove(i.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
