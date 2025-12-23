import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm"
import { Company } from "./Company"
import { Customer } from "./Customer"

@Entity("department")
@Index(["company_id"])
export class Department {
  @PrimaryGeneratedColumn()
  department_id!: number

  @Column({ type: "int" })
  company_id!: number

  @Column({ type: "varchar", length: 255 })
  department_name!: string

  @Column({ type: "text", nullable: true })
  department_comments!: string

  @CreateDateColumn({ name: "department_created_on" })
  department_created_on!: Date

  @UpdateDateColumn({ name: "department_modified_on" })
  department_modified_on!: Date

  // Relations
  @ManyToOne(() => Company, (company) => company.departments)
  @JoinColumn({ name: "company_id" })
  company!: Company

  @OneToMany(() => Customer, (customer) => customer.department)
  customers!: Customer[]
}

