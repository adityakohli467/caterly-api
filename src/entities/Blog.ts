import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { User } from "./User"

@Entity("blogs")
@Index(["slug"])
@Index(["is_published", "published_date"])
@Index(["is_featured"])
@Index(["category"])
@Index(["created_date"])
export class Blog {
  @PrimaryGeneratedColumn()
  blog_id!: number

  @Column({ type: "varchar", length: 500 })
  title!: string

  @Column({ type: "varchar", length: 500, unique: true })
  slug!: string

  @Column({ type: "varchar", length: 100, nullable: true })
  category!: string

  @Column({ type: "text", nullable: true })
  excerpt!: string

  @Column({ type: "text" })
  content!: string

  @Column({ type: "varchar", length: 500, nullable: true })
  featured_image_url!: string

  @Column({ type: "varchar", length: 255, nullable: true })
  author!: string

  @Column({ type: "text", array: true, nullable: true })
  tags!: string[]

  @Column({ type: "int", default: 5 })
  read_time!: number

  @Column({ type: "boolean", default: false })
  is_featured!: boolean

  @Column({ type: "boolean", default: false })
  is_published!: boolean

  @Column({ type: "timestamp", nullable: true })
  published_date!: Date

  @Column({ type: "int", nullable: true })
  created_by!: number

  @CreateDateColumn({ name: "created_date" })
  created_date!: Date

  @UpdateDateColumn({ name: "modified_date" })
  modified_date!: Date

  // Relations
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "created_by" })
  creator!: User
}

