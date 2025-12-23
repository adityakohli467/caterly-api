import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
} from "typeorm"
import { Permission } from "./Permission"
import { UserRole } from "./UserRole"

@Entity("roles")
@Index(["role_name"], { unique: true })
export class Role {
  @PrimaryGeneratedColumn()
  role_id!: number

  @Column({ type: "varchar", length: 255, unique: true })
  role_name!: string

  @Column({ type: "text", nullable: true })
  role_description!: string

  @Column({ type: "boolean", default: false })
  is_system_role!: boolean

  @CreateDateColumn({ name: "created_at" })
  created_at!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updated_at!: Date

  // Relations
  @OneToMany(() => UserRole, (userRole) => userRole.role)
  user_roles!: UserRole[]

  @ManyToMany(() => Permission)
  @JoinTable({
    name: "role_permissions",
    joinColumn: { name: "role_id", referencedColumnName: "role_id" },
    inverseJoinColumn: { name: "permission_id", referencedColumnName: "permission_id" },
  })
  permissions!: Permission[]
}

