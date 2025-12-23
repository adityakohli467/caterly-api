import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm"
import { Order } from "./Order"
import { Product } from "./Product"
import { OrderProductOption } from "./OrderProductOption"

@Entity("order_product")
@Index(["order_id"])
@Index(["product_id"])
export class OrderProduct {
  @PrimaryGeneratedColumn()
  order_product_id!: number

  @Column({ type: "int" })
  order_id!: number

  @Column({ type: "int", nullable: true })
  product_id!: number

  @Column({ type: "varchar", length: 255 })
  product_name!: string

  @Column({ type: "int" })
  quantity!: number

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number

  @Column({ type: "decimal", precision: 10, scale: 2 })
  total!: number

  // Relations
  @ManyToOne(() => Order, (order) => order.order_products)
  @JoinColumn({ name: "order_id" })
  order!: Order

  @ManyToOne(() => Product)
  @JoinColumn({ name: "product_id" })
  product!: Product

  @OneToMany(() => OrderProductOption, (option) => option.order_product)
  options!: OrderProductOption[]
}

