/**
 * Active tool id for shared-component analytics. Set once when the tool shell
 * mounts on a standalone tool page; shared widgets read it instead of taking
 * `tool_id` at each call site.
 */

let mountedToolAnalyticsId: string | null = null;

export function setMountedToolAnalyticsId(toolId: string | null): void {
    mountedToolAnalyticsId = toolId;
}

export function getMountedToolAnalyticsId(): string | null {
    return mountedToolAnalyticsId;
}

/** Tests reset the mounted id between cases. */
export function clearMountedToolAnalyticsId(): void {
    mountedToolAnalyticsId = null;
}
