import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from "typeorm"
import { OptionValue } from "./OptionValue"

@Entity("options")
@Index(["option_type"])
export class Option {
  @PrimaryGeneratedColumn()
  option_id!: number

  @Column({ type: "varchar", length: 255 })
  name!: string

  @Column({ type: "varchar", length: 50, default: "dropdown" })
  option_type!: string // 'radio', 'checkbox', 'dropdown', 'text'

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date

  // Relations
  @OneToMany(() => OptionValue, (optionValue) => optionValue.option)
  values!: OptionValue[]
}

