
                            <table id="datatable_ralan" class="table table-bordered table-striped table-hover display nowrap">
                                <thead>
                                    <tr>
                                        <th>Nama Pasien</th>
                                        <th>Dokter Tujuan</th>
                                        <th>No. Antrian</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
	    						<tbody>
	    						<?php
	    						$_sql = "SELECT b.nm_pasien, c.nm_dokter, a.no_reg, a.no_rkm_medis, a.no_rawat, a.stts FROM reg_periksa a, pasien b, dokter c, rujukan_internal_poli d WHERE d.kd_poli = '{$_SESSION['jenis_poli']}' AND a.no_rkm_medis = b.no_rkm_medis AND d.kd_dokter = c.kd_dokter AND a.no_rawat=d.no_rawat";
        						if(isset($_POST['tanggal']) && $_POST['tanggal'] !="") {
            						$_sql .= " AND a.tgl_registrasi = '{$_POST['tanggal']}'";
        						} else {
            						$_sql .= " AND a.tgl_registrasi = '$date'";
        						}
        						$_sql .= "  ORDER BY a.no_reg ASC";

        						$sql = query($_sql);
        						$no = 1;
								while($row = fetch_array($sql)){
		    						echo '<tr>';
		    						echo '<td>';
		    						echo '<a href="'.$_SERVER['PHP_SELF'].'?action=view&no_rawat='.$row['4'].'" class="title">'.ucwords(strtolower(SUBSTR($row['0'], 0, 20))).' ...</a>';
		    						echo '</td>';
		    						echo '<td>'.$row['1'].'</td>';
		    						echo '<td>'.$row['2'].'</td>';
		    						echo '<td>'.$row['5'].'</td>';
		    						echo '</tr>';
        							$no++;
	    						}
	    						?>
	    						</tbody>
                            </table>