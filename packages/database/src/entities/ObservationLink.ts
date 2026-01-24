/**
 * ObservationLink Entity
 *
 * Represents a link between two observations.
 */

import { Entity, PrimaryKey, Property, Index, ManyToOne } from '@mikro-orm/core';
import { Observation } from './Observation.js';

@Entity({ tableName: 'observation_links' })
export class ObservationLink {
  @PrimaryKey()
  id!: number;

  @Property()
  @Index()
  source_id!: number;

  @Property()
  @Index()
  target_id!: number;

  @Property({ default: 'related' })
  @Index()
  link_type!: string;

  @Property({ nullable: true })
  description?: string;

  @Property()
  created_at!: string;

  @Property()
  created_at_epoch!: number;

  // Relations (optional, for eager loading if needed)
  @ManyToOne(() => Observation, { nullable: true, persist: false })
  source?: Observation;

  @ManyToOne(() => Observation, { nullable: true, persist: false })
  target?: Observation;
}
