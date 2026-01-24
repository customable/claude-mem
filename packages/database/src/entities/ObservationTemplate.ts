/**
 * ObservationTemplate Entity
 *
 * Represents a template for creating observations.
 */

import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'observation_templates' })
export class ObservationTemplate {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  name!: string;

  @Property({ nullable: true })
  description?: string;

  @Property()
  @Index()
  type!: string;

  @Property({ nullable: true })
  @Index()
  project?: string;

  @Property({ type: 'text' })
  fields!: string; // JSON string of template fields

  @Property({ default: false })
  is_default?: boolean;

  @Property({ default: false })
  is_system?: boolean;

  @Property()
  created_at!: string;

  @Property()
  created_at_epoch!: number;

  @Property({ nullable: true })
  updated_at?: string;

  @Property({ nullable: true })
  updated_at_epoch?: number;
}
