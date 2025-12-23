import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from "typeorm"
import { Product } from "./Product"

@Entity("product_images")
@Index(["product_id"])
@Index(["product_id", "image_order"])
export class ProductImage {
  @PrimaryGeneratedColumn()
  product_image_id!: number

  @Column({ type: "int" })
  product_id!: number

  @Column({ type: "varchar", length: 500 })
  image_url!: string

  @Column({ type: "int", default: 0 })
  image_order!: number

  @Column({ type: "boolean", default: false })
  is_primary!: boolean

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date

  // Relations
  @ManyToOne(() => Product)
  @JoinColumn({ name: "product_id" })
  product!: Product
}

