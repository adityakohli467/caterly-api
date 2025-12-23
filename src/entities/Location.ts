import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm"

@Entity("locations")
export class Location {
  @PrimaryGeneratedColumn()
  location_id!: number

  @Column({ type: "varchar", length: 255 })
  location_name!: string

  @Column({ type: "text", nullable: true })
  location_address!: string

  @Column({ type: "varchar", length: 50, nullable: true })
  location_phone!: string

  @Column({ type: "int", default: 1 })
  location_status!: number

  @CreateDateColumn({ name: "location_created_on" })
  location_created_on!: Date

  @UpdateDateColumn({ name: "location_modified_on" })
  location_modified_on!: Date
}

