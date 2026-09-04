"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EtlSourcesTab } from "@/components/admin/etl-sources-tab"
import { EtlJobsTab } from "@/components/admin/etl-jobs-tab"
import { EtlQueryConsole } from "@/components/admin/etl-query-console"
import { useEtlSources } from "@/hooks/api/use-etl-admin-api"

function StandaloneQueryTester() {
  const { data } = useEtlSources()
  const sources = data?.data ?? []
  const [sourceId, setSourceId] = useState("")
  const [query, setQuery] = useState("")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Query console</CardTitle>
        <CardDescription>
          Try a query against any registered source before it&apos;s ever part of a job — a few
          rows, a full row count, a count of distinct values, whatever you need to check.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Register a source on the Sources tab first.
          </p>
        ) : (
          <EtlQueryConsole
            sources={sources}
            sourceId={sourceId}
            onSourceIdChange={setSourceId}
            query={query}
            onQueryChange={setQuery}
            embedded
          />
        )}
      </CardContent>
    </Card>
  )
}

export function ManageEtlView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">Data Loading (ETL)</h2>
        <p className="text-muted-foreground mt-1">
          Configure where nightly data pulls come from and what they load — the worker just runs
          what&apos;s planned and stored here, on its own schedule.
        </p>
      </div>

      <Tabs defaultValue="sources" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="query">Query console</TabsTrigger>
        </TabsList>
        <TabsContent value="sources">
          <EtlSourcesTab />
        </TabsContent>
        <TabsContent value="jobs">
          <EtlJobsTab />
        </TabsContent>
        <TabsContent value="query">
          <StandaloneQueryTester />
        </TabsContent>
      </Tabs>
    </div>
  )
}
