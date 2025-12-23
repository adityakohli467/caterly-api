import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm"

@Entity("settings")
@Index(["setting_key"], { unique: true })
@Index(["setting_category"])
export class Setting {
  @PrimaryGeneratedColumn()
  setting_id!: number

  @Column({ type: "varchar", length: 255, unique: true })
  setting_key!: string

  @Column({ type: "text", nullable: true })
  setting_value!: string

  @Column({ type: "varchar", length: 100, default: "general" })
  setting_category!: string

  @Column({ type: "varchar", length: 50, default: "string" })
  setting_type!: string

  @Column({ type: "text", nullable: true })
  description!: string

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updated_at!: Date
}

