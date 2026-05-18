import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ListChecks, Database, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "대시보드 — ESG 지표관리" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: stats, refetch } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [{ data: cats }, { data: inds }, { data: vals }] = await Promise.all([
        supabase.from("indicator_categories").select("*").order("sort_order"),
        supabase.from("indicators").select("id, category_id, name").eq("is_active", true),
        supabase
          .from("indicator_values")
          .select("id, indicator_id, period_year, updated_at, indicators(name, category_id)")
          .order("updated_at", { ascending: false })
          .limit(8),
      ]);
      return { categories: cats ?? [], indicators: inds ?? [], recentValues: vals ?? [] };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("dashboard-values")
      .on("postgres_changes", { event: "*", schema: "public", table: "indicator_values" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetch]);

  const categories = stats?.categories ?? [];
  const indicators = stats?.indicators ?? [];

  const indicatorIdsWithValues = new Set(
    (stats?.recentValues ?? []).map((v) => v.indicator_id),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground text-sm mt-1">ESG 지표 입력 현황을 한눈에 확인하세요.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">전체 지표</CardTitle>
            <ListChecks className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{indicators.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">카테고리</CardTitle>
            <Database className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">최근 입력</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.recentValues.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">카테고리별 입력 진행률</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">카테고리가 없습니다.</p>
          )}
          {categories.map((cat) => {
            const catIndicators = indicators.filter((i) => i.category_id === cat.id);
            const filled = catIndicators.filter((i) => indicatorIdsWithValues.has(i.id)).length;
            const pct = catIndicators.length === 0 ? 0 : (filled / catIndicators.length) * 100;
            return (
              <div key={cat.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={cat.esg_type === "E" ? "default" : cat.esg_type === "S" ? "secondary" : "outline"}>
                      {cat.esg_type}
                    </Badge>
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-muted-foreground text-xs">({catIndicators.length}개 지표)</span>
                  </div>
                  <span className="text-muted-foreground">{Math.round(pct)}%</span>
                </div>
                <Progress value={pct} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 입력된 데이터</CardTitle>
        </CardHeader>
        <CardContent>
          {(stats?.recentValues ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">아직 입력된 데이터가 없습니다.</p>
          ) : (
            <ul className="divide-y">
              {stats!.recentValues.map((v) => (
                <li key={v.id} className="py-2 flex items-center justify-between">
                  <Link
                    to="/indicators/$id"
                    params={{ id: v.indicator_id }}
                    className="text-sm hover:underline"
                  >
                    {(v.indicators as { name?: string } | null)?.name ?? "지표"}{" "}
                    <span className="text-muted-foreground">· {v.period_year}년</span>
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {new Date(v.updated_at).toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
