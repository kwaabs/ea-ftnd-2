"use client"

import { useMemo } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useUserStore } from "@/stores/user-store"
import { NOTIFY_EMAILS } from "@/lib/notify-config"
import { useLoginStats } from "@/hooks/api/use-login-stats-api"
import {
    ResponsiveContainer,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
} from "recharts"

const PROVIDER_COLORS: Record<string, string> = {
    azure: "#2563eb",
    ldap: "#16a34a",
    local: "#d97706",
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

function LoginStatsInner() {
    const { stats, isLoading, error } = useLoginStats()

    const chartData = useMemo(
        () => (stats?.by_day ?? []).map(d => ({ date: formatDate(d.date), count: d.count })),
        [stats],
    )

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    if (error || !stats) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-sm text-muted-foreground">Failed to load login stats. Is the backend running the latest build?</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">Login Activity</h2>
                <p className="text-muted-foreground mt-1">
                    {stats.from} to {stats.to}
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total logins</CardDescription>
                        <CardTitle className="text-3xl">{stats.total_logins}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Unique users</CardDescription>
                        <CardTitle className="text-3xl">{stats.unique_users}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg logins / user</CardDescription>
                        <CardTitle className="text-3xl">
                            {stats.unique_users > 0 ? (stats.total_logins / stats.unique_users).toFixed(1) : "0"}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">Logins per day</CardTitle>
                        <CardDescription>Last 30 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {chartData.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-12">No login activity in this range</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} name="Logins" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">By provider</CardTitle>
                        <CardDescription>Azure AD vs LDAP vs local</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats.by_provider.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-12">No data</p>
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                        <Pie
                                            data={stats.by_provider}
                                            dataKey="count"
                                            nameKey="provider"
                                            innerRadius={40}
                                            outerRadius={70}
                                        >
                                            {stats.by_provider.map(p => (
                                                <Cell key={p.provider} fill={PROVIDER_COLORS[p.provider] ?? "#94a3b8"} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex flex-col gap-1 mt-2">
                                    {stats.by_provider.map(p => (
                                        <div key={p.provider} className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-1.5 capitalize">
                                                <span
                                                    className="h-2 w-2 rounded-full"
                                                    style={{ backgroundColor: PROVIDER_COLORS[p.provider] ?? "#94a3b8" }}
                                                />
                                                {p.provider}
                                            </span>
                                            <span className="font-medium">{p.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Most frequent logins</CardTitle>
                        <CardDescription>By user, in range</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-96 overflow-y-auto">
                            {stats.by_user.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-12">No data</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-background">
                                        <tr className="border-b bg-muted/40">
                                            <th className="text-left py-2 px-4 font-medium text-muted-foreground">User</th>
                                            <th className="text-left py-2 px-4 font-medium text-muted-foreground">Provider</th>
                                            <th className="text-right py-2 px-4 font-medium text-muted-foreground">Logins</th>
                                            <th className="text-right py-2 px-4 font-medium text-muted-foreground">Last login</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.by_user.map(u => (
                                            <tr key={u.email} className="border-b last:border-0">
                                                <td className="py-2 px-4">
                                                    <div className="font-medium">{u.name || u.email.split("@")[0]}</div>
                                                    <div className="text-xs text-muted-foreground">{u.email}</div>
                                                </td>
                                                <td className="py-2 px-4">
                                                    <Badge variant="outline" className="capitalize text-[10px]">
                                                        {u.provider}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 px-4 text-right font-semibold tabular-nums">{u.login_count}</td>
                                                <td className="py-2 px-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatDateTime(u.last_login_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Recent logins</CardTitle>
                        <CardDescription>Latest activity</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-96 overflow-y-auto">
                            {stats.recent_events.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-12">No recent logins</p>
                            ) : (
                                <div className="divide-y">
                                    {stats.recent_events.map((e, idx) => (
                                        <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                            <div className="min-w-0">
                                                <div className="font-medium truncate">{e.name || e.email.split("@")[0]}</div>
                                                <div className="text-xs text-muted-foreground truncate">{e.email}</div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Badge variant="outline" className="capitalize text-[10px]">
                                                    {e.provider}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatDateTime(e.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default function LoginStatsPage() {
    const { user } = useUserStore()
    const userEmail = user?.email || user?.username || ""
    const isAllowed = NOTIFY_EMAILS.includes(userEmail)

    return (
        <AppLayout>
            {isAllowed ? (
                <LoginStatsInner />
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>
                </div>
            )}
        </AppLayout>
    )
}
