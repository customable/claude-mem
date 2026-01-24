/**
 * ProjectSettings Entity
 *
 * Stores project-specific settings and metadata.
 */

import { Entity, PrimaryKey, Property, Index, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'project_settings' })
export class ProjectSettings {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  @Unique()
  project!: string;

  @Property({ nullable: true })
  display_name?: string;

  @Property({ nullable: true })
  description?: string;

  @Property({ type: 'text', default: '{}' })
  settings!: string; // JSON string of project-specific settings

  @Property({ type: 'text', default: '{}' })
  metadata!: string; // JSON string of project metadata

  @Property({ default: 0 })
  observation_count?: number;

  @Property({ default: 0 })
  session_count?: number;

  @Property({ nullable: true })
  @Index()
  last_activity_epoch?: number;

  @Property()
  created_at!: string;

  @Property()
  created_at_epoch!: number;

  @Property({ nullable: true })
  updated_at?: string;

  @Property({ nullable: true })
  updated_at_epoch?: number;
}
