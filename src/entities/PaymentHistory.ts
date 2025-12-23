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
import { Order } from "./Order"

@Entity("payment_history")
@Index(["order_id"])
@Index(["payment_transaction_id"], { unique: true })
@Index(["payment_status"])
@Index(["customer_id"])
@Index(["created_at"])
@Index(["idempotency_key"], { unique: true })
export class PaymentHistory {
  @PrimaryGeneratedColumn()
  payment_history_id!: number

  @Column({ type: "int" })
  order_id!: number

  @Column({ type: "varchar", length: 255, unique: true })
  payment_transaction_id!: string

  @Column({ type: "varchar", length: 50, default: "charge" })
  payment_type!: string

  @Column({ type: "varchar", length: 50, default: "pending" })
  payment_status!: string

  @Column({ type: "varchar", length: 50, default: "stripe" })
  payment_gateway!: string

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount!: number

  @Column({ type: "varchar", length: 3, default: "AUD" })
  currency!: string

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  refund_amount!: number

  @Column({ type: "varchar", length: 255, nullable: true })
  customer_email!: string

  @Column({ type: "int", nullable: true })
  customer_id!: number

  @Column({ type: "varchar", length: 4, nullable: true })
  card_last4!: string

  @Column({ type: "varchar", length: 50, nullable: true })
  card_brand!: string

  @Column({ type: "int", nullable: true })
  card_expiry_month!: number

  @Column({ type: "int", nullable: true })
  card_expiry_year!: number

  @Column({ type: "varchar", length: 255, nullable: true })
  card_token!: string

  @Column({ type: "varchar", length: 50, nullable: true })
  payment_method!: string

  @Column({ type: "jsonb" })
  gateway_response!: any

  @Column({ type: "jsonb", nullable: true })
  gateway_error!: any

  @Column({ type: "inet", nullable: true })
  ip_address!: string

  @Column({ type: "text", nullable: true })
  user_agent!: string

  @Column({ type: "varchar", length: 255, nullable: true })
  request_id!: string

  @Column({ type: "varchar", length: 255, unique: true, nullable: true })
  idempotency_key!: string

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updated_at!: Date

  @Column({ type: "timestamp", nullable: true })
  processed_at!: Date

  @Column({ type: "jsonb", nullable: true })
  metadata!: any

  @Column({ type: "text", nullable: true })
  notes!: string

  // Relations
  @ManyToOne(() => Order, (order) => order.payment_history)
  @JoinColumn({ name: "order_id" })
  order!: Order
}

