import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { Option } from "./Option"

@Entity("option_value")
@Index(["option_id"])
export class OptionValue {
  @PrimaryGeneratedColumn()
  option_value_id!: number

  @Column({ type: "int" })
  option_id!: number

  @Column({ type: "varchar", length: 255 })
  name!: string

  @Column({ type: "int", default: 0 })
  sort_order!: number

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  standard_price!: number

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  wholesale_price!: number

  // Relations
  @ManyToOne(() => Option, (option) => option.values)
  @JoinColumn({ name: "option_id" })
  option!: Option
}

