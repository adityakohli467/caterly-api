import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { User } from "./User"

@Entity("general_review")
@Index(["status"])
@Index(["source"])
@Index(["created_at"])
export class GeneralReview {
  @PrimaryGeneratedColumn()
  review_id!: number

  @Column({ type: "int" })
  rating!: number

  @Column({ type: "text" })
  review_text!: string

  @Column({ type: "varchar", length: 255 })
  reviewer_name!: string

  @Column({ type: "varchar", length: 255, nullable: true })
  reviewer_email!: string

  @Column({ type: "varchar", length: 255, nullable: true })
  reviewer_location!: string

  @Column({ type: "varchar", length: 50, default: "homepage" })
  source!: string // 'homepage', 'product', 'other'

  @Column({ type: "int", default: 0 })
  status!: number // 0 = pending, 1 = approved, 2 = rejected

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updated_at!: Date

  @Column({ type: "int", nullable: true })
  reviewed_by!: number

  @Column({ type: "timestamp", nullable: true })
  reviewed_at!: Date

  // Relations
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "reviewed_by" })
  reviewer!: User
}

