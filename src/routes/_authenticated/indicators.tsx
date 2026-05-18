import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/indicators")({
  head: () => ({ meta: [{ title: "지표 목록 — ESG 지표관리" }] }),
  component: IndicatorsListPage,
});

function IndicatorsListPage() {
  const [search, setSearch] = useState("");
  const [esgFilter, setEsgFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, refetch } = useQuery({
    queryKey: ["indicators-list"],
    queryFn: async () => {
      const [{ data: cats }, { data: inds }] = await Promise.all([
        supabase.from("indicator_categories").select("*"),
        supabase.from("indicators").select("*").eq("is_active", true).order("sort_order"),
      ]);
      return { categories: cats ?? [], indicators: inds ?? [] };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("indicators-list-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "indicators" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetch]);

  const catMap = useMemo(() => {
    const m = new Map<string, { name: string; esg_type: string }>();
    (data?.categories ?? []).forEach((c) => m.set(c.id, { name: c.name, esg_type: c.esg_type }));
    return m;
  }, [data?.categories]);

  const filtered = (data?.indicators ?? []).filter((i) => {
    if (search && !`${i.code} ${i.name}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "all" && i.type !== typeFilter) return false;
    if (esgFilter !== "all") {
      const cat = i.category_id ? catMap.get(i.category_id) : undefined;
      if (cat?.esg_type !== esgFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">지표 목록</h1>
        <p className="text-muted-foreground text-sm mt-1">관리 중인 ESG 지표를 조회하고 데이터를 입력하세요.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">필터</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Input placeholder="코드 또는 이름 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-xs" />
          <Select value={esgFilter} onValueChange={setEsgFilter}>
            <SelectTrigger className="md:w-40"><SelectValue placeholder="E/S/G" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 영역</SelectItem>
              <SelectItem value="E">환경(E)</SelectItem>
              <SelectItem value="S">사회(S)</SelectItem>
              <SelectItem value="G">지배구조(G)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="md:w-40"><SelectValue placeholder="유형" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 유형</SelectItem>
              <SelectItem value="quantitative">계량</SelectItem>
              <SelectItem value="qualitative">비계량</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">코드</TableHead>
                <TableHead>지표명</TableHead>
                <TableHead className="w-32">카테고리</TableHead>
                <TableHead className="w-20">유형</TableHead>
                <TableHead className="w-20">단위</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    표시할 지표가 없습니다. 관리자가 지표를 등록하거나 엑셀로 업로드해 주세요.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((i) => {
                  const cat = i.category_id ? catMap.get(i.category_id) : undefined;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.code}</TableCell>
                      <TableCell>
                        <Link to="/indicators/$id" params={{ id: i.id }} className="font-medium hover:underline">
                          {i.name}
                        </Link>
                        {i.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{i.description}</p>}
                      </TableCell>
                      <TableCell>
                        {cat ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs">{cat.esg_type}</Badge>
                            <span className="text-xs">{cat.name}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{i.type === "quantitative" ? "계량" : "비계량"}</Badge></TableCell>
                      <TableCell className="text-xs">{i.unit || "—"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
