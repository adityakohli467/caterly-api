import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm"

@Entity("coupon")
@Index(["coupon_code"])
@Index(["status"])
export class Coupon {
  @PrimaryGeneratedColumn()
  coupon_id!: number

  @Column({ type: "varchar", length: 50, unique: true })
  coupon_code!: string

  @Column({ type: "varchar", length: 1, default: "P" }) // P = Percentage, F = Fixed
  type!: string

  @Column({ type: "decimal", precision: 10, scale: 2 })
  coupon_discount!: number

  @Column({ type: "int", default: 1 })
  status!: number

  @Column({ type: "date", nullable: true })
  date_start!: Date

  @Column({ type: "date", nullable: true })
  date_end!: Date

  @CreateDateColumn({ name: "date_added" })
  date_added!: Date

  @UpdateDateColumn({ name: "date_modified" })
  date_modified!: Date
}

