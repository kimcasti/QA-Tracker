import React, { useId, useState } from 'react';
import { Button } from 'antd';

export function ProjectExternalContactsDisclosure({ title, count, children, action, summary }: {
  title: string; count: number | string; children: React.ReactNode;
  action?: React.ReactNode; summary?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  return <>
    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
    <Button type="text" className="!h-auto !max-w-full !whitespace-normal !text-left !font-semibold"
      aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(value => !value)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> {title} ({count})
    </Button>
    {action}
    </div>
    {summary}
    <div id={panelId} hidden={!expanded}>{children}</div>
  </>;
}
