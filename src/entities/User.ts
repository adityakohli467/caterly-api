import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm"
import { Role } from "./Role"
import { UserRole } from "./UserRole"

@Entity("user")
@Index(["username"], { unique: true })
@Index(["email"], { unique: true })
@Index(["auth_level"])
@Index(["role_id"])
export class User {
  @PrimaryGeneratedColumn()
  user_id!: number

  @Column({ type: "varchar", length: 255, unique: true })
  username!: string

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string

  @Column({ type: "varchar", length: 255 })
  password!: string

  @Column({ type: "int", default: 1 })
  auth_level!: number

  @Column({ type: "int", nullable: true })
  role_id!: number

  @Column({ type: "varchar", length: 255, nullable: true })
  firstname!: string

  @Column({ type: "varchar", length: 255, nullable: true })
  lastname!: string

  @Column({ type: "int", default: 1 })
  status!: number

  @CreateDateColumn({ name: "date_added" })
  date_added!: Date

  @UpdateDateColumn({ name: "date_modified" })
  date_modified!: Date

  // Relations
  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: "role_id" })
  role!: Role

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  user_roles!: UserRole[]
}

