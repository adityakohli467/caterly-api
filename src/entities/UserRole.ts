import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { User } from "./User"
import { Role } from "./Role"

@Entity("user_roles")
@Index(["user_id", "role_id"], { unique: true })
export class UserRole {
  @PrimaryGeneratedColumn()
  user_role_id!: number

  @Column({ type: "int" })
  user_id!: number

  @Column({ type: "int" })
  role_id!: number

  @Column({ type: "boolean", default: false })
  is_primary!: boolean

  @Column({ type: "int", nullable: true })
  assigned_by!: number

  @CreateDateColumn({ name: "assigned_at" })
  assigned_at!: Date

  // Relations
  @ManyToOne(() => User, (user) => user.user_roles)
  @JoinColumn({ name: "user_id" })
  user!: User

  @ManyToOne(() => Role, (role) => role.user_roles)
  @JoinColumn({ name: "role_id" })
  role!: Role
}

