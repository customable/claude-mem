/**
 * Share Routes
 *
 * API endpoints for memory sharing and collaboration.
 */

import type { Request, Response } from 'express';
import { BaseRouter } from './base-router.js';
import type { ShareService } from '../services/share-service.js';
import type {
  CreateShareOptions,
  ImportShareOptions,
  ShareBundle,
  SharePrivacyLevel,
  ObservationType,
} from '@claude-mem/types';

/**
 * Helper to get string from query/params
 */
function getString(val: unknown): string | undefined {
  if (Array.isArray(val)) return val[0];
  if (typeof val === 'string') return val;
  return undefined;
}

/**
 * Helper to get string array from query
 */
function getStringArray(val: unknown): string[] | undefined {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return undefined;
}

export interface ShareRouterDeps {
  shareService: ShareService;
}

export class ShareRouter extends BaseRouter {
  constructor(private readonly deps: ShareRouterDeps) {
    super();
  }

  protected setupRoutes(): void {
    // Create a shareable bundle
    this.router.post('/create', this.asyncHandler(this.createShare.bind(this)));

    // Preview what would be shared
    this.router.post('/preview', this.asyncHandler(this.previewShare.bind(this)));

    // Import a share bundle
    this.router.post('/import', this.asyncHandler(this.importShare.bind(this)));

    // Validate a share bundle
    this.router.post('/validate', this.asyncHandler(this.validateBundle.bind(this)));

    // Get audit log
    this.router.get('/audit', this.asyncHandler(this.getAuditLog.bind(this)));
    this.router.get('/audit/:shareId', this.asyncHandler(this.getShareAuditLog.bind(this)));

    // Download share as file
    this.router.post('/download', this.asyncHandler(this.downloadShare.bind(this)));
  }

  /**
   * POST /api/share/create
   * Create a shareable bundle
   */
  private async createShare(req: Request, res: Response): Promise<void> {
    const body = req.body as Partial<CreateShareOptions> & {
      projects?: string[];
      types?: string[];
      tags?: string[];
      dateStart?: string;
      dateEnd?: string;
      includeSummaries?: boolean;
      includeSessions?: boolean;
      limit?: number;
    };

    // Build scope from body
    const scope: CreateShareOptions['scope'] = {
      projects: body.projects || body.scope?.projects,
      types: (body.types || body.scope?.types) as ObservationType[] | undefined,
      tags: body.tags || body.scope?.tags,
      dateRange: body.dateStart || body.dateEnd || body.scope?.dateRange
        ? {
            start: body.dateStart || body.scope?.dateRange?.start,
            end: body.dateEnd || body.scope?.dateRange?.end,
          }
        : undefined,
      includeSummaries: body.includeSummaries ?? body.scope?.includeSummaries ?? false,
      includeSessions: body.includeSessions ?? body.scope?.includeSessions ?? false,
      limit: body.limit || body.scope?.limit,
    };

    const options: CreateShareOptions = {
      title: body.title,
      description: body.description,
      createdBy: body.createdBy,
      privacyLevel: (body.privacyLevel as SharePrivacyLevel) ?? 'redacted',
      scope,
      customMetadata: body.customMetadata,
    };

    const bundle = await this.deps.shareService.createShare(options);

    this.success(res, {
      bundle,
      message: 'Share bundle created successfully',
    });
  }

  /**
   * POST /api/share/preview
   * Preview what would be shared
   */
  private async previewShare(req: Request, res: Response): Promise<void> {
    const body = req.body as Partial<CreateShareOptions> & {
      projects?: string[];
      types?: string[];
      tags?: string[];
      dateStart?: string;
      dateEnd?: string;
      includeSummaries?: boolean;
      includeSessions?: boolean;
      limit?: number;
    };

    // Build scope from body
    const scope: CreateShareOptions['scope'] = {
      projects: body.projects || body.scope?.projects,
      types: (body.types || body.scope?.types) as ObservationType[] | undefined,
      tags: body.tags || body.scope?.tags,
      dateRange: body.dateStart || body.dateEnd || body.scope?.dateRange
        ? {
            start: body.dateStart || body.scope?.dateRange?.start,
            end: body.dateEnd || body.scope?.dateRange?.end,
          }
        : undefined,
      includeSummaries: body.includeSummaries ?? body.scope?.includeSummaries ?? false,
      includeSessions: body.includeSessions ?? body.scope?.includeSessions ?? false,
      limit: body.limit || body.scope?.limit,
    };

    const options: CreateShareOptions = {
      privacyLevel: (body.privacyLevel as SharePrivacyLevel) ?? 'redacted',
      scope,
    };

    const preview = await this.deps.shareService.previewShare(options);

    this.success(res, preview);
  }

  /**
   * POST /api/share/import
   * Import a share bundle
   */
  private async importShare(req: Request, res: Response): Promise<void> {
    const { bundle, options } = req.body as {
      bundle: ShareBundle;
      options?: ImportShareOptions;
    };

    if (!bundle) {
      this.badRequest('bundle is required');
    }

    // Validate bundle structure first
    const validation = this.deps.shareService.validateBundle(bundle);
    if (!validation.valid) {
      this.badRequest(`Invalid bundle: ${validation.errors.join(', ')}`);
    }

    const importOptions: ImportShareOptions = {
      skipExisting: options?.skipExisting ?? true,
      projectPrefix: options?.projectPrefix,
      targetProject: options?.targetProject,
      dryRun: options?.dryRun ?? false,
    };

    const result = await this.deps.shareService.importShare(bundle, importOptions);

    this.success(res, result);
  }

  /**
   * POST /api/share/validate
   * Validate a share bundle
   */
  private async validateBundle(req: Request, res: Response): Promise<void> {
    const { bundle } = req.body as { bundle: ShareBundle };

    if (!bundle) {
      this.badRequest('bundle is required');
    }

    const validation = this.deps.shareService.validateBundle(bundle);

    this.success(res, validation);
  }

  /**
   * GET /api/share/audit
   * Get all audit log entries
   */
  private async getAuditLog(_req: Request, res: Response): Promise<void> {
    const auditLog = this.deps.shareService.getAuditLog();

    this.success(res, {
      entries: auditLog,
      count: auditLog.length,
    });
  }

  /**
   * GET /api/share/audit/:shareId
   * Get audit log entries for a specific share
   */
  private async getShareAuditLog(req: Request, res: Response): Promise<void> {
    const shareId = getString(req.params.shareId);

    if (!shareId) {
      this.badRequest('shareId is required');
    }

    const auditLog = this.deps.shareService.getAuditLog(shareId);

    this.success(res, {
      shareId,
      entries: auditLog,
      count: auditLog.length,
    });
  }

  /**
   * POST /api/share/download
   * Create a share and return as downloadable file
   */
  private async downloadShare(req: Request, res: Response): Promise<void> {
    const body = req.body as Partial<CreateShareOptions> & {
      projects?: string[];
      types?: string[];
      tags?: string[];
      dateStart?: string;
      dateEnd?: string;
      includeSummaries?: boolean;
      includeSessions?: boolean;
      limit?: number;
    };

    // Build scope from body
    const scope: CreateShareOptions['scope'] = {
      projects: body.projects || body.scope?.projects,
      types: (body.types || body.scope?.types) as ObservationType[] | undefined,
      tags: body.tags || body.scope?.tags,
      dateRange: body.dateStart || body.dateEnd || body.scope?.dateRange
        ? {
            start: body.dateStart || body.scope?.dateRange?.start,
            end: body.dateEnd || body.scope?.dateRange?.end,
          }
        : undefined,
      includeSummaries: body.includeSummaries ?? body.scope?.includeSummaries ?? false,
      includeSessions: body.includeSessions ?? body.scope?.includeSessions ?? false,
      limit: body.limit || body.scope?.limit,
    };

    const options: CreateShareOptions = {
      title: body.title,
      description: body.description,
      createdBy: body.createdBy,
      privacyLevel: (body.privacyLevel as SharePrivacyLevel) ?? 'redacted',
      scope,
      customMetadata: body.customMetadata,
    };

    const bundle = await this.deps.shareService.createShare(options);

    // Generate filename
    const projectPart = scope.projects?.length === 1
      ? `-${scope.projects[0]}`
      : scope.projects?.length
        ? '-multi'
        : '';
    const filename = `claude-mem-share${projectPart}-${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(bundle, null, 2));
  }
}
