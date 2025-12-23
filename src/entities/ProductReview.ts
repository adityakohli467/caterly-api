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
import { Product } from "./Product"
import { Customer } from "./Customer"
import { User } from "./User"

@Entity("product_review")
@Index(["product_id"])
@Index(["status"])
@Index(["customer_id"])
@Index(["created_at"])
export class ProductReview {
  @PrimaryGeneratedColumn()
  review_id!: number

  @Column({ type: "int" })
  product_id!: number

  @Column({ type: "int", nullable: true })
  customer_id!: number

  @Column({ type: "int", nullable: true })
  user_id!: number

  @Column({ type: "int" })
  rating!: number

  @Column({ type: "text" })
  review_text!: string

  @Column({ type: "varchar", length: 255, nullable: true })
  reviewer_name!: string

  @Column({ type: "varchar", length: 255, nullable: true })
  reviewer_email!: string

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
  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: "product_id" })
  product!: Product

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: "customer_id" })
  customer!: Customer

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "user_id" })
  user!: User

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "reviewed_by" })
  reviewer!: User
}

