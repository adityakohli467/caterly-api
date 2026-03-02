import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from "typeorm"

@Entity("quotation_inquiry")
@Index(["email"])
@Index(["status"])
export class QuotationInquiry {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar", length: 255 })
    name!: string

    @Column({ type: "varchar", length: 50 })
    contact!: string

    @Column({ type: "varchar", length: 255 })
    email!: string

    @Column({ type: "varchar", length: 255, nullable: true })
    delivery_date_time!: string

    @Column({ type: "varchar", length: 255, nullable: true })
    occasion!: string

    @Column({ type: "text", nullable: true })
    message!: string

    @Column({ type: "varchar", length: 50, default: "pending" })
    status!: string

    @CreateDateColumn({ name: "created_at" })
    created_at!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updated_at!: Date
}
