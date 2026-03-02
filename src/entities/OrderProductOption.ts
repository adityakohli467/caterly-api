import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { OrderProduct } from "./OrderProduct"

@Entity("order_product_option")
@Index(["order_product_id"])
export class OrderProductOption {
  @PrimaryGeneratedColumn()
  order_product_option_id!: number

  @Column({ type: "int" })
  order_product_id!: number

  @Column({ type: "varchar", length: 255 })
  option_name!: string

  @Column({ type: "varchar", length: 255 })
  option_value!: string

  @Column({ type: "int", default: 1 })
  option_quantity!: number

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  option_price!: number

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  option_total!: number

  @Column({ type: "int", nullable: true })
  order_id!: number

  @Column({ type: "int", nullable: true, default: 0 })
  product_option_id!: number

  // Relations
  @ManyToOne(() => OrderProduct, (orderProduct) => orderProduct.options)
  @JoinColumn({ name: "order_product_id" })
  order_product!: OrderProduct
}

