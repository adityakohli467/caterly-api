import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
  Index,
} from "typeorm"
import { Role } from "./Role"

@Entity("permissions")
@Index(["permission_key"], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn()
  permission_id!: number

  @Column({ type: "varchar", length: 255, unique: true })
  permission_key!: string

  @Column({ type: "varchar", length: 255 })
  permission_name!: string

  @Column({ type: "text", nullable: true })
  permission_description!: string

  @Column({ type: "varchar", length: 100, default: "general" })
  permission_category!: string

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date

  // Relations
  @ManyToMany(() => Role, (role) => role.permissions)
  roles!: Role[]
}

