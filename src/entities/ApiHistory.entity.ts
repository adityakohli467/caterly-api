import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm"
import { User } from "./User"
import { Customer } from "./Customer"

@Entity("api_history")
@Index(["created_at"])
@Index(["user_id"])
@Index(["customer_id"])
@Index(["event_type"])
@Index(["event_category"])
@Index(["resource_type"])
@Index(["resource_id"])
@Index(["request_method"])
@Index(["request_path"])
@Index(["is_successful"])
@Index(["user_type"])
export class ApiHistory {
  @PrimaryGeneratedColumn()
  history_id!: number

  // Request Information
  @Column({ type: "varchar", length: 10 })
  request_method!: string

  @Column({ type: "text" })
  request_url!: string

  @Column({ type: "text" })
  request_path!: string

  @Column({ type: "text", nullable: true })
  request_query!: string

  @Column({ type: "text", nullable: true })
  request_headers!: string

  @Column({ type: "text", nullable: true })
  request_body!: string

  @Column({ type: "varchar", length: 45, nullable: true })
  request_ip!: string

  @Column({ type: "text", nullable: true })
  user_agent!: string

  // Response Information
  @Column({ type: "int", nullable: true })
  response_status!: number

  @Column({ type: "text", nullable: true })
  response_body!: string

  @Column({ type: "int", nullable: true })
  response_time_ms!: number

  // User Information
  @Column({ type: "int", nullable: true })
  user_id!: number

  @Column({ type: "varchar", length: 255, nullable: true })
  username!: string

  @Column({ type: "int", nullable: true })
  customer_id!: number

  @Column({ type: "varchar", length: 20, nullable: true })
  user_type!: string

  // Event Information
  @Column({ type: "varchar", length: 50, nullable: true })
  event_type!: string

  @Column({ type: "varchar", length: 50, nullable: true })
  event_category!: string

  @Column({ type: "text", nullable: true })
  event_description!: string

  // Resource Information
  @Column({ type: "varchar", length: 50, nullable: true })
  resource_type!: string

  @Column({ type: "int", nullable: true })
  resource_id!: number

  // Additional Metadata
  @Column({ type: "boolean", default: true })
  is_successful!: boolean

  @Column({ type: "text", nullable: true })
  error_message!: string

  @Column({ type: "text", nullable: true })
  error_stack!: string

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date

  // Relations
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "user_id" })
  user!: User

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: "customer_id" })
  customer!: Customer
}

