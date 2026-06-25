import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type AppRole = "admin" | "editor" | "viewer";

interface UserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string | null;
  role: AppRole | null;
}

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "사용자 관리 — ESG 지표관리" }] }),
  component: AdminUsersPage,
});

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "관리자",
  editor: "편집자",
  viewer: "조회자",
};

const ROLE_VARIANT: Record<AppRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  editor: "secondary",
  viewer: "outline",
};

function AdminUsersPage() {
  const { isAdmin, user, loading } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [pending, setPending] = useState<Record<string, AppRole>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.display_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, query, roleFilter]);

  if (loading) return null;
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          관리자만 접근할 수 있습니다.
        </CardContent>
      </Card>
    );
  }

  const save = async (row: UserRow) => {
    const next = pending[row.user_id];
    if (!next || next === row.role) return;
    setSavingId(row.user_id);
    const { error } = await supabase.rpc("admin_set_user_role", {
      _target: row.user_id,
      _new_role: next,
    });
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`권한이 ${ROLE_LABEL[next]}(으)로 변경되었습니다.`);
    setPending((p) => {
      const { [row.user_id]: _, ...rest } = p;
      return rest;
    });
    await refetch();
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>사용자 권한 관리</CardTitle>
          <CardDescription>
            가입된 사용자에게 관리자 · 편집자 · 조회자 권한을 부여합니다. 마지막 관리자는 강등할 수 없습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <Input
              placeholder="이메일 또는 이름 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="md:max-w-xs"
            />
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
              <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 권한</SelectItem>
                <SelectItem value="admin">관리자</SelectItem>
                <SelectItem value="editor">편집자</SelectItem>
                <SelectItem value="viewer">조회자</SelectItem>
              </SelectContent>
            </Select>
            <div className="md:ml-auto text-sm text-muted-foreground">
              총 {filtered.length}명
            </div>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이메일</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead>현재 권한</TableHead>
                  <TableHead>권한 변경</TableHead>
                  <TableHead className="text-right">저장</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">불러오는 중…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">결과가 없습니다.</TableCell></TableRow>
                ) : filtered.map((row) => {
                  const isSelf = row.user_id === user?.id;
                  const current = row.role ?? "viewer";
                  const selected = pending[row.user_id] ?? current;
                  const dirty = selected !== current;
                  // self-demotion guard for last admin handled DB-side too
                  const selfDemoteBlocked = isSelf && current === "admin" && selected !== "admin";
                  return (
                    <TableRow key={row.user_id}>
                      <TableCell className="font-medium">
                        {row.email ?? "—"}
                        {isSelf && <span className="ml-2 text-xs text-muted-foreground">(나)</span>}
                      </TableCell>
                      <TableCell>{row.display_name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString("ko-KR") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_VARIANT[current]}>{ROLE_LABEL[current]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={selected}
                          onValueChange={(v) => setPending((p) => ({ ...p, [row.user_id]: v as AppRole }))}
                          disabled={selfDemoteBlocked && false /* allow choosing, but block save */}
                        >
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">관리자</SelectItem>
                            <SelectItem value="editor">편집자</SelectItem>
                            <SelectItem value="viewer">조회자</SelectItem>
                          </SelectContent>
                        </Select>
                        {selfDemoteBlocked && (
                          <div className="text-xs text-destructive mt-1">본인 관리자 권한은 직접 강등할 수 없습니다.</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          disabled={!dirty || savingId === row.user_id || selfDemoteBlocked}
                          onClick={() => save(row)}
                        >
                          {savingId === row.user_id ? "저장 중…" : "저장"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
