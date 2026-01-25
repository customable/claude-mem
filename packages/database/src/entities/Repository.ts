/**
 * Repository Entity
 *
 * Tracks git repositories discovered during sessions.
 */

import { Entity, PrimaryKey, Property, Index, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'repositories' })
export class Repository {
  @PrimaryKey()
  id!: number;

  @Property()
  @Unique()
  @Index()
  repo_path!: string;

  @Property({ nullable: true })
  remote_url?: string;

  @Property()
  @Index()
  name!: string;

  @Property()
  created_at_epoch!: number;

  @Property()
  @Index()
  last_seen_epoch!: number;
}
